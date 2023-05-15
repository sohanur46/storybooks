import path from 'path';
import fse from 'fs-extra';
import { dedent } from 'ts-dedent';
import type { NpmOptions } from '../NpmOptions';
import type { SupportedRenderers, SupportedFrameworks, Builder } from '../project_types';
import { SupportedLanguage, externalFrameworks, CoreBuilder } from '../project_types';
import { copyTemplateFiles, paddedLog } from '../helpers';
import { configureMain, configurePreview } from './configure';
import type { JsPackageManager } from '../js-package-manager';
import { getPackageDetails } from '../js-package-manager';
import { getBabelPresets, writeBabelConfigFile } from '../babel-config';
import packageVersions from '../versions';
import type { FrameworkOptions, GeneratorOptions } from './types';
import {
  configureEslintPlugin,
  extractEslintInfo,
  suggestESLintPlugin,
} from '../automigrate/helpers/eslintPlugin';

const defaultOptions: FrameworkOptions = {
  extraPackages: [],
  extraAddons: [],
  staticDir: undefined,
  addScripts: true,
  addMainFile: true,
  addComponents: true,
  skipBabel: false,
  extraMain: undefined,
  framework: undefined,
  extensions: undefined,
  componentsDestinationPath: undefined,
  storybookConfigFolder: '.storybook',
};

const getBuilderDetails = (builder: string) => {
  const map = packageVersions as Record<string, string>;

  if (map[builder]) {
    return builder;
  }

  const builderPackage = `@storybook/${builder}`;
  if (map[builderPackage]) {
    return builderPackage;
  }

  return builder;
};

const getExternalFramework = (framework: string) =>
  externalFrameworks.find(
    (exFramework) =>
      framework !== undefined &&
      (exFramework.name === framework ||
        exFramework.packageName === framework ||
        exFramework?.frameworks?.some?.((item) => item === framework))
  );

const getFrameworkPackage = (framework: string, renderer: string, builder: string) => {
  const externalFramework = getExternalFramework(framework);

  if (externalFramework === undefined) {
    return framework ? `@storybook/${framework}` : `@storybook/${renderer}-${builder}`;
  }

  if (externalFramework.frameworks !== undefined) {
    return externalFramework.frameworks.find((item) => item.match(new RegExp(`-${builder}`)));
  }

  return externalFramework.packageName;
};

const getRendererPackage = (framework: string, renderer: string) => {
  const externalFramework = getExternalFramework(framework);
  if (externalFramework !== undefined)
    return externalFramework.renderer || externalFramework.packageName;

  return `@storybook/${renderer}`;
};

const wrapForPnp = (packageName: string) =>
  `%%path.dirname(require.resolve(path.join('${packageName}', 'package.json')))%%`;

const getFrameworkDetails = (
  renderer: SupportedRenderers,
  builder: Builder,
  pnp: boolean,
  framework?: SupportedFrameworks
): {
  type: 'framework' | 'renderer';
  packages: string[];
  builder?: string;
  framework?: string;
  renderer?: string;
  rendererId: SupportedRenderers;
} => {
  const frameworkPackage = getFrameworkPackage(framework, renderer, builder);

  const frameworkPackagePath = pnp ? wrapForPnp(frameworkPackage) : frameworkPackage;

  const rendererPackage = getRendererPackage(framework, renderer);
  const rendererPackagePath = pnp ? wrapForPnp(rendererPackage) : rendererPackage;

  const builderPackage = getBuilderDetails(builder);
  const builderPackagePath = pnp ? wrapForPnp(builderPackage) : builderPackage;

  const isExternalFramework = !!getExternalFramework(frameworkPackage);
  const isKnownFramework =
    isExternalFramework || !!(packageVersions as Record<string, string>)[frameworkPackage];
  const isKnownRenderer = !!(packageVersions as Record<string, string>)[rendererPackage];

  if (isKnownFramework) {
    return {
      packages: [rendererPackage, frameworkPackage],
      framework: frameworkPackagePath,
      rendererId: renderer,
      type: 'framework',
    };
  }

  if (isKnownRenderer) {
    return {
      packages: [rendererPackage, builderPackage],
      builder: builderPackagePath,
      renderer: rendererPackagePath,
      rendererId: renderer,
      type: 'renderer',
    };
  }

  throw new Error(
    `Could not find the framework (${frameworkPackage}) or renderer (${rendererPackage}) package`
  );
};

const stripVersions = (addons: string[]) => addons.map((addon) => getPackageDetails(addon)[0]);

const hasInteractiveStories = (rendererId: SupportedRenderers) =>
  ['react', 'angular', 'preact', 'svelte', 'vue', 'vue3', 'html', 'solid', 'qwik'].includes(
    rendererId
  );

const hasFrameworkTemplates = (framework?: SupportedFrameworks) =>
  ['angular', 'nextjs'].includes(framework);

export async function baseGenerator(
  packageManager: JsPackageManager,
  npmOptions: NpmOptions,
  { language, builder = CoreBuilder.Webpack5, pnp, frameworkPreviewParts }: GeneratorOptions,
  renderer: SupportedRenderers,
  options: FrameworkOptions = defaultOptions,
  framework?: SupportedFrameworks
) {
  const {
    extraAddons: extraAddonPackages,
    extraPackages,
    staticDir,
    addScripts,
    addMainFile,
    addComponents,
    skipBabel,
    extraMain,
    extensions,
    storybookConfigFolder,
    componentsDestinationPath,
  } = {
    ...defaultOptions,
    ...options,
  };

  const {
    packages: frameworkPackages,
    type,
    rendererId,
    framework: frameworkInclude,
    builder: builderInclude,
  } = getFrameworkDetails(renderer, builder, pnp, framework);

  // added to main.js
  const addons = [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    ...stripVersions(extraAddonPackages),
  ];
  // added to package.json
  const addonPackages = [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/blocks',
    ...extraAddonPackages,
  ];

  if (hasInteractiveStories(rendererId)) {
    addons.push('@storybook/addon-interactions');
    addonPackages.push(
      '@storybook/addon-interactions',
      '@storybook/testing-library@^0.0.14-next.1'
    );
  }

  const files = await fse.readdir(process.cwd());

  const packageJson = await packageManager.retrievePackageJson();
  const installedDependencies = new Set(
    Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies })
  );

  if (!installedDependencies.has('react')) {
    // we add these here because they are required by addon-essentials > addon-docs
    addonPackages.push('react');
  }
  if (!installedDependencies.has('react-dom')) {
    // we add these here because they are required by addon-essentials > addon-docs
    addonPackages.push('react-dom');
  }

  // TODO: We need to start supporting this at some point
  if (type === 'renderer') {
    throw new Error(
      dedent`
        Sorry, for now, you can not do this, please use a framework such as @storybook/react-webpack5

        https://github.com/storybookjs/storybook/issues/18360
      `
    );
  }

  const packages = [
    'storybook',
    getExternalFramework(rendererId) ? undefined : `@storybook/${rendererId}`,
    ...frameworkPackages,
    ...addonPackages,
    ...extraPackages,
  ]
    .filter(Boolean)
    .filter(
      (packageToInstall) => !installedDependencies.has(getPackageDetails(packageToInstall)[0])
    );

  paddedLog(`\nGetting the correct version of ${packages.length} packages`);
  const versionedPackages = await packageManager.getVersionedPackages(packages);

  await fse.ensureDir(`./${storybookConfigFolder}`);

  if (addMainFile) {
    await configureMain({
      framework: { name: frameworkInclude, options: options.framework || {} },
      storybookConfigFolder,
      docs: { autodocs: 'tag' },
      addons: pnp ? addons.map(wrapForPnp) : addons,
      extensions,
      language,
      ...(staticDir ? { staticDirs: [path.join('..', staticDir)] } : null),
      ...extraMain,
      ...(type !== 'framework'
        ? {
            core: {
              builder: builderInclude,
            },
          }
        : {}),
    });
  }

  await configurePreview({ frameworkPreviewParts, storybookConfigFolder, language, rendererId });

  const depsToInstall = [...versionedPackages];

  // Add basic babel config for a select few frameworks that need it, if they do not have a babel config file already
  if (builder !== CoreBuilder.Vite && !skipBabel) {
    const frameworksThatNeedBabelConfig = [
      '@storybook/react-webpack5',
      '@storybook/vue-webpack5',
      '@storybook/vue3-webpack5',
      '@storybook/html-webpack5',
      '@storybook/web-components-webpack5',
    ];
    const needsBabelConfig = frameworkPackages.find((pkg) =>
      frameworksThatNeedBabelConfig.includes(pkg)
    );
    const hasNoBabelFile = !files.some(
      (fname) => fname.startsWith('.babel') || fname.startsWith('babel')
    );

    if (hasNoBabelFile && needsBabelConfig) {
      const isTypescript = language !== SupportedLanguage.JAVASCRIPT;
      const isReact = rendererId === 'react';
      depsToInstall.push(
        ...getBabelPresets({
          typescript: isTypescript,
          jsx: isReact,
        })
      );
      await writeBabelConfigFile({
        typescript: isTypescript,
        jsx: isReact,
      });
    }
  }

  try {
    if (process.env.CI !== 'true') {
      const { hasEslint, isStorybookPluginInstalled, eslintConfigFile } = await extractEslintInfo(
        packageManager
      );

      if (hasEslint && !isStorybookPluginInstalled) {
        const shouldInstallESLintPlugin = await suggestESLintPlugin();
        if (shouldInstallESLintPlugin) {
          depsToInstall.push('eslint-plugin-storybook');
          await configureEslintPlugin(eslintConfigFile, packageManager);
        }
      }
    }
  } catch (err) {
    // any failure regarding configuring the eslint plugin should not fail the whole generator
  }

  if (depsToInstall.length > 0) {
    paddedLog('Installing Storybook dependencies');
    await packageManager.addDependencies({ ...npmOptions, packageJson }, depsToInstall);
  }

  if (addScripts) {
    await packageManager.addStorybookCommandInScripts({
      port: 6006,
    });
  }

  if (addComponents) {
    const templateLocation = hasFrameworkTemplates(framework) ? framework : rendererId;
    await copyTemplateFiles({
      renderer: templateLocation,
      packageManager,
      language,
      destination: componentsDestinationPath,
    });
  }
}
