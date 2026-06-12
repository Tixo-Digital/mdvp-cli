{
  description = "MDVP CLI development and smoke-test environment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [
        "aarch64-darwin"
        "aarch64-linux"
        "x86_64-linux"
      ];

      forAllSystems = nixpkgs.lib.genAttrs systems;

      pkgsFor = system: import nixpkgs {
        inherit system;
      };

      shellPackages = pkgs:
        [
          pkgs.nodejs_22
          pkgs.git
          pkgs.jq
        ]
        ++ pkgs.lib.optionals pkgs.stdenv.isLinux [
          pkgs.chromium
        ];

      script = pkgs: name: body: pkgs.writeShellApplication {
        inherit name;
        runtimeInputs = shellPackages pkgs;
        text = ''
          set -euo pipefail
          export PUPPETEER_SKIP_DOWNLOAD="''${PUPPETEER_SKIP_DOWNLOAD:-true}"
          if command -v chromium >/dev/null 2>&1; then
            export PUPPETEER_EXECUTABLE_PATH="''${PUPPETEER_EXECUTABLE_PATH:-$(command -v chromium)}"
          fi
          ${body}
        '';
      };
    in
    {
      devShells = forAllSystems (system:
        let pkgs = pkgsFor system;
        in {
          default = pkgs.mkShell {
            packages = shellPackages pkgs;
            env.PUPPETEER_SKIP_DOWNLOAD = "true";
            shellHook = ''
              if command -v chromium >/dev/null 2>&1; then
                export PUPPETEER_EXECUTABLE_PATH="''${PUPPETEER_EXECUTABLE_PATH:-$(command -v chromium)}"
              fi
              echo "MDVP dev shell: Node $(node --version)"
            '';
          };
        });

      apps = forAllSystems (system:
        let
          pkgs = pkgsFor system;
          verify = script pkgs "mdvp-verify" ''
            npm ci
            npm test
            npm pack --dry-run
          '';
          smoke = script pkgs "mdvp-smoke" ''
            node cli.mjs help
            node cli.mjs top 5
            node cli.mjs stats --json
          '';
          staticAudit = script pkgs "mdvp-static-audit" ''
            MDVP_USE_CACHE=1 node cli.mjs audit "''${1:-mdvp.dev}" --json
          '';
        in {
          verify = {
            type = "app";
            program = "${verify}/bin/mdvp-verify";
            meta.description = "Run npm ci, npm test, and npm pack --dry-run";
          };
          smoke = {
            type = "app";
            program = "${smoke}/bin/mdvp-smoke";
            meta.description = "Run non-browser MDVP CLI smoke checks";
          };
          static-audit = {
            type = "app";
            program = "${staticAudit}/bin/mdvp-static-audit";
            meta.description = "Run an MDVP static/cache audit with MDVP_USE_CACHE=1";
          };
        });

      formatter = forAllSystems (system:
        let pkgs = pkgsFor system;
        in pkgs.nixpkgs-fmt);
    };
}
