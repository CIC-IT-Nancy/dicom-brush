# Dicom Brush

A TypeScript/JavaScript library for manipulating DICOM images, enabling redaction (masking) of image regions, metadata
extraction, and transfer syntax transcoding.

---

## Features

- **ImageBrush**: Apply redaction areas to DICOM images
- **ImageReader**: Extract technical metadata and specific frames
- **ImageTranscoder**: Transcode DICOM files between transfer syntaxes (pack/unpack)
- **Utils**: Utility functions for DICOM tag manipulation

---

## Installation

Install the package using your preferred package manager:

```bash
# Using npm
npm install @cic-it-nancy/dicom-brush

# Using pnpm
pnpm add @cic-it-nancy/dicom-brush

# Using Yarn
yarn add @cic-it-nancy/dicom-brush
```

---

## Usage

### Loading DICOM files

The library uses `dcmjs` to read and write DICOM files. You first need to obtain a `dicomDict` object using `dcmjs`:

```typescript
import { data } from 'dcmjs';
import { ImageTranscoder, ImageBrush } from '@cic-it-nancy/dicom-brush';

// Load DICOM file using dcmjs
const dicomDict = data.DicomMessage.readFile(blob);
```

### Transcoding

```typescript
import { ImageTranscoder } from '@cic-it-nancy/dicom-brush';

// Initialise the transcoder (required once)
await ImageTranscoder.init();

// Transcode a DICOM file
const transcoder = new ImageTranscoder(dicomDict);

// Transcode to a different transfer syntax
const result = transcoder.transcode('1.2.840.10008.1.2.1'); // Explicit VR Little Endian

// Helper methods for common operations
const unpacked = transcoder.unpack();  // Unpack to Implicit VR Little Endian
const packed = transcoder.pack();      // Pack to JPEG 2000 Lossless
```

### Redaction

```typescript
import { ImageBrush } from '@cic-it-nancy/dicom-brush';

const brush = new ImageBrush(dicomDict);

// Add redaction area (x, y, width, height in pixels)
brush.addRedactionArea({
  x: 100,
  y: 100,
  width: 50,
  height: 50
});

// Apply the redaction
await brush.apply();

// Get the modified DICOM dictionary
const redactedDicom = brush.getDicomDict();
```

### Reading image information

```typescript
import { ImageReader } from '@cic-it-nancy/dicom-brush';

const imageInfo = ImageReader.readImageInfo(dicomDict);

console.log(imageInfo.rows);           // Number of rows
console.log(imageInfo.columns);        // Number of columns
console.log(imageInfo.numberOfFrames); // Total frames
console.log(imageInfo.transferSyntaxUID);
```

---

## Supported Transfer Syntaxes

Transfer syntax support depends on the `dcmjs-codecs` library, which provides WebAssembly-based codecs. Currently supported:

- **Uncompressed**:
  - Implicit VR Little Endian (`1.2.840.10008.1.2`)
  - Explicit VR Little Endian (`1.2.840.10008.1.2.1`)
  - Deflated Explicit VR Little Endian (`1.2.840.10008.1.2.1.99`)
  - Explicit VR Big Endian (`1.2.840.10008.1.2.2`)

- **JPEG**:
  - JPEG Baseline (`1.2.840.10008.1.2.4.50`)
  - JPEG Lossless (`1.2.840.10008.1.2.4.70`)

- **JPEG 2000**:
  - JPEG 2000 Lossless (`1.2.840.10008.1.2.4.90`)

- **RLE Lossless** (`1.2.840.10008.1.2.5`)

Note: The actual supported transfer syntaxes are determined by `dcmjs-codecs`. Check the [dcmjs-codecs repository](https://github.com/PantelisGeorgiadis/dcmjs-codecs) for the most up-to-date list.

---

## Technical details

- **Build output**: CJS (`lib/cjs/`) and ESM (`lib/esm/`)
- **TypeScript**: Strict mode, type declarations available in `types/index.d.ts`
- **Dependencies**: `dcmjs` (0.50.1) for DICOM I/O, `dcmjs-codecs` (0.0.8) for transcoding

---

## Project structure

```text
dicom-brush/
├── src/          # TypeScript source files
├── lib/
│   ├── cjs/      # CommonJS build
│   └── esm/      # ES Module build
├── types/        # TypeScript type definitions
├── README.md
└── Transfer Syntax.md
```

---

## Authors & Contributors

- **CIC-IT Nancy** — Author
- **Pierre 'AlasDiablo' M** ([GitHub](https://github.com/AlasDiablo)) — Contributor

---

## License

GNU Lesser General Public License v3.0 (LGPL-3.0) - CIC-IT Nancy
