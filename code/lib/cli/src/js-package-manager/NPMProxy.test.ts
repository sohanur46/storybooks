import { NPMProxy } from './NPMProxy';

// mock createLogStream
jest.mock('../utils', () => ({
  createLogStream: jest.fn(() => ({
    logStream: '',
    readLogFile: jest.fn(),
    moveLogFile: jest.fn(),
    removeLogFile: jest.fn(),
  })),
}));

describe('NPM Proxy', () => {
  let npmProxy: NPMProxy;

  beforeEach(() => {
    npmProxy = new NPMProxy();
  });

  it('type should be npm', () => {
    expect(npmProxy.type).toEqual('npm');
  });

  describe('initPackageJson', () => {
    it('should run `npm init -y`', async () => {
      const executeCommandSpy = jest.spyOn(npmProxy, 'executeCommand').mockResolvedValueOnce('');

      await npmProxy.initPackageJson();

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'npm', args: ['init', '-y'] })
      );
    });
  });

  describe('setRegistryUrl', () => {
    it('should run `npm config set registry https://foo.bar`', async () => {
      const executeCommandSpy = jest.spyOn(npmProxy, 'executeCommand').mockResolvedValueOnce('');

      await npmProxy.setRegistryURL('https://foo.bar');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'npm',
          args: ['config', 'set', 'registry', 'https://foo.bar'],
        })
      );
    });
  });

  describe('installDependencies', () => {
    describe('npm6', () => {
      it('should run `npm install`', async () => {
        const executeCommandSpy = jest
          .spyOn(npmProxy, 'executeCommand')
          .mockResolvedValueOnce('6.0.0');

        await npmProxy.installDependencies();

        expect(executeCommandSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({ command: 'npm', args: ['install'] })
        );
      });
    });
    describe('npm7', () => {
      it('should run `npm install`', async () => {
        const executeCommandSpy = jest
          .spyOn(npmProxy, 'executeCommand')
          .mockResolvedValueOnce('7.1.0');

        await npmProxy.installDependencies();

        expect(executeCommandSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({ command: 'npm', args: ['install'] })
        );
      });
    });
  });

  describe('runScript', () => {
    describe('npm6', () => {
      it('should execute script `npm exec -- compodoc -e json -d .`', async () => {
        const executeCommandSpy = jest
          .spyOn(npmProxy, 'executeCommand')
          .mockResolvedValueOnce('6.0.0');

        npmProxy.runPackageCommand('compodoc', ['-e', 'json', '-d', '.']);

        expect(executeCommandSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({
            command: 'npm',
            args: ['exec', '--', 'compodoc', '-e', 'json', '-d', '.'],
          })
        );
      });
    });
    describe('npm7', () => {
      it('should execute script `npm run compodoc -- -e json -d .`', async () => {
        const executeCommandSpy = jest
          .spyOn(npmProxy, 'executeCommand')
          .mockResolvedValueOnce('7.1.0');

        await npmProxy.runPackageCommand('compodoc', ['-e', 'json', '-d', '.']);

        expect(executeCommandSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({
            command: 'npm',
            args: ['exec', '--', 'compodoc', '-e', 'json', '-d', '.'],
          })
        );
      });
    });
  });

  describe('addDependencies', () => {
    describe('npm6', () => {
      it('with devDep it should run `npm install -D @storybook/preview-api`', async () => {
        const executeCommandSpy = jest
          .spyOn(npmProxy, 'executeCommand')
          .mockResolvedValueOnce('6.0.0');

        await npmProxy.addDependencies({ installAsDevDependencies: true }, [
          '@storybook/preview-api',
        ]);

        expect(executeCommandSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({
            command: 'npm',
            args: ['install', '-D', '@storybook/preview-api'],
          })
        );
      });
    });
    describe('npm7', () => {
      it('with devDep it should run `npm install -D @storybook/preview-api`', async () => {
        const executeCommandSpy = jest
          .spyOn(npmProxy, 'executeCommand')
          .mockResolvedValueOnce('7.0.0');

        await npmProxy.addDependencies({ installAsDevDependencies: true }, [
          '@storybook/preview-api',
        ]);

        expect(executeCommandSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({
            command: 'npm',
            args: ['install', '-D', '@storybook/preview-api'],
          })
        );
      });
    });
  });

  describe('removeDependencies', () => {
    describe('npm6', () => {
      it('with devDep it should run `npm uninstall @storybook/preview-api`', async () => {
        const executeCommandSpy = jest
          .spyOn(npmProxy, 'executeCommand')
          .mockResolvedValueOnce('6.0.0');

        npmProxy.removeDependencies({}, ['@storybook/preview-api']);

        expect(executeCommandSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({ command: 'npm', args: ['uninstall', '@storybook/preview-api'] })
        );
      });
    });
    describe('npm7', () => {
      it('with devDep it should run `npm uninstall @storybook/preview-api`', async () => {
        const executeCommandSpy = jest
          .spyOn(npmProxy, 'executeCommand')
          .mockResolvedValueOnce('7.0.0');

        await npmProxy.removeDependencies({}, ['@storybook/preview-api']);

        expect(executeCommandSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({ command: 'npm', args: ['uninstall', '@storybook/preview-api'] })
        );
      });
    });
    describe('skipInstall', () => {
      it('should only change package.json without running install', async () => {
        const executeCommandSpy = jest
          .spyOn(npmProxy, 'executeCommand')
          .mockResolvedValueOnce('7.0.0');
        const writePackageSpy = jest
          .spyOn(npmProxy, 'writePackageJson')
          .mockImplementation(jest.fn());

        await npmProxy.removeDependencies(
          {
            skipInstall: true,
            packageJson: {
              devDependencies: {
                '@storybook/manager-webpack5': 'x.x.x',
                '@storybook/react': 'x.x.x',
              },
            },
          },
          ['@storybook/manager-webpack5']
        );

        expect(writePackageSpy).toHaveBeenCalledWith({
          devDependencies: {
            '@storybook/react': 'x.x.x',
          },
        });
        expect(executeCommandSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('latestVersion', () => {
    it('without constraint it returns the latest version', async () => {
      const executeCommandSpy = jest
        .spyOn(npmProxy, 'executeCommand')
        .mockResolvedValueOnce('"5.3.19"');

      const version = await npmProxy.latestVersion('@storybook/preview-api');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'npm',
          args: ['info', '@storybook/preview-api', 'version', '--json'],
        })
      );
      expect(version).toEqual('5.3.19');
    });

    it('with constraint it returns the latest version satisfying the constraint', async () => {
      const executeCommandSpy = jest
        .spyOn(npmProxy, 'executeCommand')
        .mockResolvedValueOnce('["4.25.3","5.3.19","6.0.0-beta.23"]');

      const version = await npmProxy.latestVersion('@storybook/preview-api', '5.X');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'npm',
          args: ['info', '@storybook/preview-api', 'versions', '--json'],
        })
      );
      expect(version).toEqual('5.3.19');
    });

    it('throws an error if command output is not a valid JSON', async () => {
      jest.spyOn(npmProxy, 'executeCommand').mockResolvedValueOnce('NOT A JSON');

      await expect(npmProxy.latestVersion('@storybook/preview-api')).rejects.toThrow();
    });
  });

  describe('getVersion', () => {
    it('with a Storybook package listed in versions.json it returns the version', async () => {
      // eslint-disable-next-line global-require
      const storybookAngularVersion = require('../versions').default['@storybook/angular'];
      const executeCommandSpy = jest
        .spyOn(npmProxy, 'executeCommand')
        .mockResolvedValueOnce('"5.3.19"');

      const version = await npmProxy.getVersion('@storybook/angular');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'npm',
          args: ['info', '@storybook/angular', 'version', '--json'],
        })
      );
      expect(version).toEqual(`^${storybookAngularVersion}`);
    });

    it('with a Storybook package not listed in versions.json it returns the latest version', async () => {
      const packageVersion = '5.3.19';
      const executeCommandSpy = jest
        .spyOn(npmProxy, 'executeCommand')
        .mockResolvedValueOnce(`"${packageVersion}"`);

      const version = await npmProxy.getVersion('@storybook/react-native');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'npm',
          args: ['info', '@storybook/react-native', 'version', '--json'],
        })
      );
      expect(version).toEqual(`^${packageVersion}`);
    });
  });

  describe('addPackageResolutions', () => {
    it('adds resolutions to package.json and account for existing resolutions', async () => {
      const writePackageSpy = jest
        .spyOn(npmProxy, 'writePackageJson')
        .mockImplementation(jest.fn());

      jest.spyOn(npmProxy, 'retrievePackageJson').mockImplementation(
        jest.fn(async () => ({
          dependencies: {},
          devDependencies: {},
          overrides: {
            bar: 'x.x.x',
          },
        }))
      );

      const versions = {
        foo: 'x.x.x',
      };
      await npmProxy.addPackageResolutions(versions);

      expect(writePackageSpy).toHaveBeenCalledWith({
        dependencies: {},
        devDependencies: {},
        overrides: {
          ...versions,
          bar: 'x.x.x',
        },
      });
    });
  });

  describe('mapDependencies', () => {
    it('should display duplicated dependencies based on npm output', async () => {
      // npm ls --depth 10 --json
      jest.spyOn(npmProxy, 'executeCommand').mockResolvedValueOnce(`
        {
          "dependencies": {
            "unrelated-and-should-be-filtered": {
              "version": "1.0.0"
            },
            "@storybook/addon-interactions": {
              "version": "7.0.0-rc.7",
              "resolved": "https://registry.npmjs.org/@storybook/addon-interactions/-/addon-interactions-7.0.0-rc.7.tgz",
              "overridden": false,
              "dependencies": {
                "@storybook/instrumenter": {
                  "version": "6.0.0",
                  "resolved": "https://registry.npmjs.org/@storybook/instrumenter/-/instrumenter-7.0.0-rc.7.tgz",
                  "overridden": false,
                  "dependencies": {
                    "@storybook/channels": {
                      "version": "7.0.0-rc.7"
                    }
                  }
                }
              }
            },
            "@storybook/instrumenter": {
              "version": "7.0.0-beta.11",
              "resolved": "https://registry.npmjs.org/@storybook/instrumenter/-/instrumenter-7.0.0-beta.11.tgz",
              "overridden": false,
              "dependencies": {}
            },
            "@storybook/jest": {
              "version": "0.0.11-next.1",
              "resolved": "https://registry.npmjs.org/@storybook/jest/-/jest-0.0.11-next.1.tgz",
              "overridden": false,
              "dependencies": {
                "@storybook/instrumenter": {
                  "version": "7.0.0-alpha.21"
                }
              }
            },
            "@storybook/testing-library": {
              "version": "0.0.14-next.1",
              "resolved": "https://registry.npmjs.org/@storybook/testing-library/-/testing-library-0.0.14-next.1.tgz",
              "overridden": false,
              "dependencies": {
                "@storybook/instrumenter": {
                  "version": "5.4.2-alpha.0"
                }
              }
            }
          }
        }      
      `);

      const installations = await npmProxy.findInstallations();

      expect(installations).toMatchInlineSnapshot(`
        Object {
          "dependencies": Object {
            "@storybook/addon-interactions": Array [
              Object {
                "location": "",
                "version": "7.0.0-rc.7",
              },
            ],
            "@storybook/channels": Array [
              Object {
                "location": "",
                "version": "7.0.0-rc.7",
              },
            ],
            "@storybook/instrumenter": Array [
              Object {
                "location": "",
                "version": "6.0.0",
              },
              Object {
                "location": "",
                "version": "7.0.0-beta.11",
              },
              Object {
                "location": "",
                "version": "7.0.0-alpha.21",
              },
              Object {
                "location": "",
                "version": "5.4.2-alpha.0",
              },
            ],
            "@storybook/jest": Array [
              Object {
                "location": "",
                "version": "0.0.11-next.1",
              },
            ],
            "@storybook/testing-library": Array [
              Object {
                "location": "",
                "version": "0.0.14-next.1",
              },
            ],
          },
          "duplicatedDependencies": Object {
            "@storybook/instrumenter": Array [
              "5.4.2-alpha.0",
              "6.0.0",
              "7.0.0-alpha.21",
              "7.0.0-beta.11",
            ],
          },
          "infoCommand": "npm ls --depth=1",
        }
      `);
    });
  });

  describe('parseErrors', () => {
    it('should parse npm errors', () => {
      const NPM_ERROR_SAMPLE = `
        npm ERR! code ERESOLVE
        npm ERR! ERESOLVE unable to resolve dependency tree
        npm ERR! 
        npm ERR! While resolving: before-storybook@1.0.0
        npm ERR! Found: react@undefined
        npm ERR! node_modules/react
        npm ERR!   react@"30" from the root project
        npm ERR! 
        npm ERR! Could not resolve dependency:
        npm ERR! peer react@"^16.8.0 || ^17.0.0 || ^18.0.0" from @storybook/react@7.1.0-alpha.17
        npm ERR! node_modules/@storybook/react
        npm ERR!   dev @storybook/react@"^7.1.0-alpha.17" from the root project
        npm ERR! 
        npm ERR! Fix the upstream dependency conflict, or retry
        npm ERR! this command with --force or --legacy-peer-deps
        npm ERR! to accept an incorrect (and potentially broken) dependency resolution.
        npm ERR! 
        npm ERR! 
        npm ERR! For a full report see:
        npm ERR! /Users/yannbraga/.npm/_logs/2023-05-12T08_38_18_464Z-eresolve-report.txt

        npm ERR! A complete log of this run can be found in:
        npm ERR!     /Users/yannbraga/.npm/_logs/2023-05-12T08_38_18_464Z-debug-0.log
        `;

      expect(npmProxy.parseErrorFromLogs(NPM_ERROR_SAMPLE)).toEqual(
        'ERESOLVE: Dependency resolution error.'
      );
    });

    it('should show unknown npm error', () => {
      const NPM_ERROR_SAMPLE = `
        npm ERR! 
        npm ERR! While resolving: before-storybook@1.0.0
        npm ERR! Found: react@undefined
        npm ERR! node_modules/react
        npm ERR!   react@"30" from the root project
      `;

      expect(npmProxy.parseErrorFromLogs(NPM_ERROR_SAMPLE)).toEqual(`Unknown NPM error`);
    });

    it('should show unknown npm error with code if it at least matches the pattern', () => {
      const NPM_ERROR_SAMPLE = `
        npm ERR! code ESOMETHING
        npm ERR! ESOMETHING something something
        npm ERR! 
      `;

      expect(npmProxy.parseErrorFromLogs(NPM_ERROR_SAMPLE)).toEqual(
        `Unknown NPM error: ESOMETHING`
      );
    });
  });
});
