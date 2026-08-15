{
  description = "Cross-platform on-screen keyboard for different languages";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    # `self` is always passed in, so the ellipsis is required even though it is unused.
    { nixpkgs, ... }:

    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;

      packagesFor = system: {
        default = nixpkgs.legacyPackages.${system}.callPackage ./nix/package.nix { };
      };
    in
    {
      packages = forAllSystems packagesFor;

      # Same derivations as `packages`, exposed so `nix flake check` actually
      # builds them. CI runs it against this flake's own locked nixpkgs and
      # against the stable channel that consumers pin us to via `follows`,
      # which is what keeps pnpmDeps.hash honest on both. See .github/workflows/nix.yaml.
      checks = forAllSystems packagesFor;

      overlays.default = final: _prev: {
        keyboard-app = final.callPackage ./nix/package.nix { };
      };
    };
}
