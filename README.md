# EDL Maker

EDL Maker is a fast, web-based tool designed to help you quickly generate Edit Decision Lists (EDLs) to mute offensive language and cut unwanted visual scenes from local video files.

Built with React and Vite, it works entirely in your browser using local files, ensuring your large video constraints and privacy remain completely secure.

## Features

- **Local Video Scrubbing**: Drag and drop any modern video file (`.mp4`, `.mkv`, etc.) to instantly begin playback without uploading anything to the internet.
- **Visual Cuts**: Easily scrub through the video timeline and use the `Mark IN` and `Mark OUT` controls to define precise moments you want to completely cut from the video.
- **Audio Muting via Subtitles**:
  - Direct integration with the **OpenSubtitles API**. Search for your movie title and automatically download the matched `.srt` subtitles file.
  - Alternately, load your own local `.srt` file.
- **Customizable Profanity Filter**: A built-in, editable wordlist automatically scans the loaded subtitle track and generates precise audio mute markers for every matched word sequence.
- **Intelligent Conflict Resolution**: Sometimes a visual cut and an audio mute overlap. EDL Maker automatically resolves these conflicts by cleanly splitting or merging the timestamps (prioritizing visual cuts) so your editing software doesn't crash on import.
- **Instant Export**: Export a standard `.edl` text file, fully formatted to be immediately dropped into DaVinci Resolve, Premiere Pro, or any other compatible NLE software.

## Setup & Development

This project uses modern JavaScript tooling (Node.js, Vite, React).

```bash
# 1. Install dependencies
npm install

# 2. Run the local development server
npm run dev
```

The app will start instantly. Note that because of web browser CORS security constraints, accessing the OpenSubtitles API directly from the client is blocked. **Running the app via `npm run dev` ensures that the built-in Vite API proxy correctly routes your subtitle downloads.** see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
