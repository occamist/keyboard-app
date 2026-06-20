<h1><img src="logo.png" width="64" style="vertical-align: middle;"/> keyboard-app </h1>

[![Version](https://img.shields.io/github/tag/occamist/keyboard-app.svg)](https://github.com/occamist/keyboard-app/tags)
[![CI Build](https://github.com/occamist/keyboard-app/actions/workflows/tests.yaml/badge.svg)](https://github.com/occamist/keyboard-app/actions/workflows/tests.yaml)
[![License](https://img.shields.io/github/license/occamist/keyboard-app)](https://github.com/occamist/keyboard-app/blob/main/LICENSE)

Cross-platform on-screen keyboard for different languages, keyboard app supersedes [virtual-keyboard](https://github.com/occamist/virtual-keyboard)

![screenshot](screenshot.png)

### Getting Started

Grab the app from latest releases [here](https://github.com/occamist/keyboard-app/releases)

Or build locally

```shell
git clone https://github.com/occamist/keyboard-app
pnpm install && pnpm tauri build 
```

Or install via the provided script (Linux only)

```shell
git clone https://github.com/occamist/keyboard-app && cd keyboard-app
chmod +x install.sh && ./install.sh
```

### FAQs

- What are supported languages?

German, Italian, Korean, Lao, Thai, Turkish, Vietnamese

- What platforms are supported?

Linux(1st class), Windows, Macos

- Why Tauri?

Smallest bundles and easy to port across different platforms.
