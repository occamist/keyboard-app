<h1><img src="logo.png" width="64" style="vertical-align: middle;"/> keyboard-app </h1>

[![Version](https://img.shields.io/github/tag/occamist/keyboard-app.svg)](https://github.com/occamist/keyboard-app/tags)
[![CI Build](https://github.com/occamist/keyboard-app/actions/workflows/tests.yaml/badge.svg)](https://github.com/occamist/keyboard-app/actions/workflows/tests.yaml)
[![License](https://img.shields.io/github/license/occamist/keyboard-app)](https://github.com/occamist/keyboard-app/blob/main/LICENSE)

Cross-platform on-screen keyboard for different languages, keyboard app supersedes [virtual-keyboard](https://github.com/occamist/virtual-keyboard)

![screenshot](screenshot.png)

### Getting Started

Grab the app from [the latest releases](https://github.com/occamist/keyboard-app/releases)

Or build locally from the source by yourself

```shell
git clone https://github.com/occamist/keyboard-app
pnpm install && pnpm tauri build 
```

### Nix

Or run directly with Nix

```shell
nix run github:occamist/keyboard-app
```

Or add it as a flake input in your own `flake.nix` (NixOS)

```nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    keyboard-app = {
      url = "github:occamist/keyboard-app";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, keyboard-app, ... }@inputs: {
    # ...
  };
}
```

then reference it in `environment.systemPackages`

```nix
{ pkgs, inputs, ... }:
{
  environment.systemPackages = [
    inputs.keyboard-app.packages.${pkgs.stdenv.hostPlatform.system}.default
  ];
}
```


### FAQs

- What are supported languages?

German, Italian, Korean, Lao, Thai, Turkish, Vietnamese

- What platforms are supported?

Linux (1st class), Windows, Macos

- Why Tauri?

Smallest bundles and easy to port across different platforms.
