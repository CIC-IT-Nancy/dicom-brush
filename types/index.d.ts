// noinspection JSUnusedGlobalSymbols

declare namespace DicomBrush {
    import type { DicomDict, Dict } from './@types/dcmjs';

    /**
     * Represents a rectangular area to be redacted from an image.
     */
    export interface RedactionArea {
        /** The x-coordinate of the top-left corner of the redaction area. */
        readonly x: number;
        /** The y-coordinate of the top-left corner of the redaction area. */
        readonly y: number;
        /** The width of the redaction area. */
        readonly width: number;
        /** The height of the redaction area. */
        readonly height: number;
    }

    /**
     * Essential information about the DICOM image metadata.
     */
    export interface ImageInfo {
        /** The transfer syntax UID of the DICOM image. */
        transferSyntaxUID: string;
        /** Number of rows in the image. */
        rows: number;
        /** Number of columns in the image. */
        columns: number;
        /** Number of bits allocated per pixel sample. */
        bitsAllocated: number;
        /** Number of samples per pixel (e.g. 1 for grayscale, 3 for RGB). */
        samplesPerPixel: number;
        /** Planar configuration (0 for R1, G1, B1, R2, G2, B2, …, etc., 1 for R1, R2, R3, …, G1, G2, G3, …, B1, B2, B3, etc.). */
        planarConfiguration: number;
        /** Total number of frames in the DICOM dataset. */
        numberOfFrames: number;
        /** The photometric interpretation (e.g. MONOCHROME2, RGB, YBR_FULL). */
        photometricInterpretation: string;
        /** Whether the pixel data is signed (true) or unsigned (false). */
        signed: boolean;
    }

    /**
     * Possible typed arrays for representing pixel data.
     */
    export type PixelDataTypedArray =
        | Float32Array<ArrayBuffer>
        | Int16Array<ArrayBuffer>
        | Uint8Array<ArrayBuffer>
        | Uint16Array<ArrayBuffer>;

    /**
     * Class responsible for applying redactions to DICOM images.
     * It handles uncompressing the image if it is in a compressed transfer syntax.
     */
    export class ImageBrush {
        /**
         * Constructs a new instance of ImageBrush with the provided DICOM dictionary.
         * If the DICOM data is compressed, it will be automatically unpacked.
         *
         * @param dicomDict - The DicomDict instance containing DICOM data.
         */
        public constructor(dicomDict: DicomDict);

        /**
         * Adds one or more redaction areas to be applied to the image.
         *
         * @param redactions - A single RedactionArea or an array of RedactionArea objects.
         */
        public addRedactionArea(
            redactions: RedactionArea | RedactionArea[],
        ): void;

        /**
         * Applies all added redactions to the pixel data.
         */
        public async apply(): Promise<void>;

        /**
         * Returns the DICOM dataset after applying all redactions.
         */
        public getDicomDict(): DicomDict;
    }

    /**
     * Utility class for reading image information and extracting frames from a DICOM dataset.
     */
    export class ImageReader {
        /**
         * Constructs a new instance of the ImageReader class.
         *
         * @param dicomDict - The DicomDict instance containing DICOM data.
         * @param imageInfo - Pre-extracted information about the image.
         */
        public constructor(dicomDict: DicomDict, imageInfo: ImageInfo);

        /**
         * Normalises the Photometric Interpretation of the DICOM dataset.
         *
         * @param dicomDict - The DicomDict instance to normalise.
         */
        public static normalisePhotometricInterpretation(
            dicomDict: DicomDict,
        ): void;

        /**
         * Reads the Transfer Syntax UID from the DICOM meta-information.
         *
         * @param dicomDict - The DicomDict instance to read from.
         * @returns The Transfer Syntax UID.
         */
        public static readTransferSyntaxUID(dicomDict: DicomDict): string;

        /**
         * Checks if the DICOM dataset or Transfer Syntax UID is in a "native" (uncompressed) transfer syntax.
         *
         * @param transferSyntaxUIDOrDicomDict - The DicomDict or Transfer Syntax UID to check.
         * @returns True if the transfer syntax is native, false otherwise.
         */
        public static isNativeTransferSyntax(
            transferSyntaxUIDOrDicomDict: DicomDict | string,
        ): boolean;

        /**
         * Reads and extracts image information (metadata) from a DicomDict.
         *
         * @param dicomDict - The DicomDict instance to read from.
         * @returns The extracted ImageInfo object.
         * @throws Error if essential pixel data information is missing.
         */
        public static readImageInfo(dicomDict: DicomDict): ImageInfo;

        /**
         * Extracts a specific frame from the pixel data.
         *
         * Note:
         *  - This function ensures that the pixel data is returned as little-endian,
         *    performing byte swapping for big-endian transfer syntaxes if necessary.
         *
         * @param index - The index of the frame to extract (1-based index).
         * @returns The pixel data of the requested frame as a typed array.
         * @throws Error if the frame index is out of bounds.
         */
        public async getFrame(index: number): Promise<PixelDataTypedArray>;

        /**
         * Gets the Value Representation (VR) of the pixel data in the DICOM dataset.
         *
         * @returns The VR of the pixel data ('OB', 'OF', or 'OW').
         */
        public getVR(): 'OB' | 'OF' | 'OW';
    }

    /**
     * Class providing methods to transcode DICOM datasets between different transfer syntaxes.
     */
    export class ImageTranscoder {
        /**
         * Constructs a new instance of the ImageTranscoder class.
         *
         * @param dicomDict - The DicomDict instance to be transcoded.
         */
        public constructor(dicomDict: DicomDict);

        /**
         * Initialises the transcoding module with provided options, including WebAssembly module paths.
         * This must be called before any transcoding operation if using NativeCodecs.
         *
         * @param opts - Configuration options for initialisation.
         * @param opts.dcmjsWebAssemblyModulePathOrUrl - Optional path or URL to the WebAssembly module.
         * @param opts.logCodecsInfo - Whether to log codec information.
         * @param opts.logCodecsTrace - Whether to log detailed codec traces.
         * @returns A promise that resolves when initialisation is complete.
         */
        public static init(opts?: {
            dcmjsWebAssemblyModulePathOrUrl?: string;
            logCodecsInfo?: boolean;
            logCodecsTrace?: boolean;
        }): Promise<void>;

        /**
         * Transcodes the DICOM dataset to a specified target transfer syntax.
         *
         * @param targetTransferSyntaxUID - The UID of the destination transfer syntax.
         * @param params - Optional parameters for the transcoding process (quality, rate, etc.).
         * @param params.quality - Desired quality level for lossy transcoding.
         * @param params.allowedLossyError - Acceptable level of error for lossy transcoding.
         * @param params.progressionOrder - Progression order for the transcoding process.
         * @param params.rate - Bit rate to be used in transcoding.
         * @returns The updated DicomDict in the target transfer syntax.
         */
        public transcode(
            targetTransferSyntaxUID: string,
            params?: {
                quality?: number;
                allowedLossyError?: number;
                progressionOrder?: string;
                rate?: number;
            },
        ): DicomDict;

        /**
         * Transcodes the DICOM dataset to Implicit VR Little Endian (uncompressed).
         *
         * @returns The uncompressed DicomDict.
         */
        public unpack(): DicomDict;

        /**
         * Transcodes the DICOM dataset to JPEG 2000 Lossless transfer syntax.
         *
         * @returns The compressed DicomDict.
         */
        public pack(): DicomDict;
    }

    /**
     * Set of utility functions for DICOM tag manipulation and syntax checking.
     */
    export const Utils: {
        /**
         * Retrieves a string value from a specific DICOM tag.
         *
         * @param dict - The DICOM dictionary.
         * @param address - The tag address (e.g. '00280004').
         * @returns The tag value as a string, or null if not found or not a string.
         */
        getStringTagValue: (dict: Dict, address: string) => string | null;

        /**
         * Retrieves a numeric value from a specific DICOM tag.
         *
         * @param dict - The DICOM dictionary.
         * @param address - The tag address (e.g. '00280010').
         * @returns The tag value as a number, or null if not found or not a valid number.
         */
        getNumberTagValue: (dict: Dict, address: string) => number | null;
    };

    /**
     * Default export containing all main classes and utilities.
     */
    const _default: {
        ImageBrush: typeof ImageBrush;
        ImageTranscoder: typeof ImageTranscoder;
        ImageReader: typeof ImageReader;
        Utils: typeof Utils;
    };

    export default _default;
}

export = DicomBrush;
