import ImageReader from './ImageReader';
import Utils, {
    BITS_STORED,
    EXPLICIT_VR_LITTLE_ENDIAN,
    HIGH_BIT,
    PHOTOMETRIC_INTERPRETATION,
    PIXEL_DATA,
    PLANAR_CONFIGURATION,
    TRANSFER_SYNTAX_UID,
} from './Utils';

import codecs from 'dcmjs-codecs';

import type { ImageInfo, PixelDataTypedArray, RedactionArea } from '../types';
import type { DicomDict } from '../types/@types/dcmjs';

const { Transcoder, constants } = codecs;
const { TransferSyntax } = constants;

interface EncodedPixelModule {
    Rows: number;
    Columns: number;
    BitsAllocated: number;
    BitsStored: number;
    HighBit: number;
    SamplesPerPixel: number;
    PixelRepresentation: number;
    PhotometricInterpretation: string;
    PlanarConfiguration?: number;
}

function toArrayBuffer(frame: ArrayBuffer | Uint8Array) {
    if (frame instanceof ArrayBuffer) {
        return frame;
    }

    if (
        frame.byteOffset === 0 &&
        frame.byteLength === frame.buffer.byteLength
    ) {
        return frame.buffer as ArrayBuffer;
    }

    return frame;
}

function toOwnedArrayBuffer(frame: ArrayBuffer | Uint8Array): ArrayBuffer {
    if (frame instanceof ArrayBuffer) {
        return frame;
    }

    if (
        frame.byteOffset === 0 &&
        frame.byteLength === frame.buffer.byteLength
    ) {
        return frame.buffer as ArrayBuffer;
    }

    return frame.buffer.slice(
        frame.byteOffset,
        frame.byteOffset + frame.byteLength,
    ) as ArrayBuffer;
}

class ImageBrush {
    private readonly dicomDict: DicomDict;
    private imageInfo: ImageInfo;

    private readonly redactions: RedactionArea[];

    private locked: boolean;

    public constructor(dicomDict: DicomDict) {
        this.dicomDict = dicomDict;

        if (!ImageReader.isNativeTransferSyntax(this.dicomDict)) {
            ImageReader.normalisePhotometricInterpretation(this.dicomDict);
        }

        this.imageInfo = ImageReader.readImageInfo(this.dicomDict);

        this.redactions = [];

        this.locked = false;
    }

    public addRedactionArea(redactions: RedactionArea | RedactionArea[]): void {
        if (this.locked) {
            throw new Error('Redaction already applied');
        }

        if (Array.isArray(redactions)) {
            this.redactions.push(...redactions);
            return;
        }

        this.redactions.push(redactions);
    }

    public apply(): void {
        if (this.locked) {
            throw new Error('Redaction already applied');
        }

        this.locked = true;
        this._applyPixelDataRedaction();
    }

    public getDicomDict(): DicomDict {
        if (!this.locked) {
            throw new Error('Redaction not applied');
        }

        return this.dicomDict;
    }

    private _applyPixelDataRedaction(): void {
        if (
            !ImageReader.isNativeTransferSyntax(
                this.imageInfo.transferSyntaxUID,
            )
        ) {
            this._applyEncapsulatedRedaction();
            return;
        }

        const imageReader = new ImageReader(this.dicomDict, this.imageInfo);

        for (
            let frameIndex = 1;
            frameIndex <= this.imageInfo.numberOfFrames;
            frameIndex++
        ) {
            const pixelArray = imageReader.getFrame(frameIndex);

            for (const redaction of this.redactions) {
                this._applyRedactionToSingleFrame(
                    pixelArray,
                    redaction,
                    this.imageInfo,
                );
            }
        }
    }

    private _applyEncapsulatedRedaction(): void {
        const pixelDataElement = this.dicomDict.dict[PIXEL_DATA];

        if (!pixelDataElement || !Array.isArray(pixelDataElement.Value)) {
            throw new Error('Encapsulated PixelData not found.');
        }

        const fragments = pixelDataElement.Value as Array<
            ArrayBuffer | Uint8Array
        >;
        if (
            fragments.length === 0 ||
            (this.imageInfo.numberOfFrames > 1 &&
                fragments.length !== this.imageInfo.numberOfFrames)
        ) {
            throw new Error(
                'Encapsulated PixelData must contain one fragment per frame.',
            );
        }

        for (const fragment of fragments) {
            if (
                !(fragment instanceof ArrayBuffer) &&
                !(fragment instanceof Uint8Array)
            ) {
                throw new Error('Unsupported encapsulated PixelData fragment.');
            }
        }

        const sourcePixelModule = this._createSourcePixelModule();
        const frameCount = this.imageInfo.numberOfFrames;
        let outputPixelModule: EncodedPixelModule | undefined;

        for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
            const frameFragments =
                frameCount === 1 ? fragments : [fragments[frameIndex]];
            const decoder = new Transcoder(
                {
                    ...sourcePixelModule,
                    NumberOfFrames: 1,
                    PixelData: frameFragments.map(toArrayBuffer),
                },
                this.imageInfo.transferSyntaxUID,
            );
            decoder.transcode(TransferSyntax.ExplicitVRLittleEndian);

            const decodedElements = decoder.getElements();
            const decodedPixelData = this._getSinglePixelData(
                decodedElements.PixelData,
            );
            const decodedPixelModule = this._readPixelModule(decodedElements);
            const frameInfo = this._createImageInfo(decodedPixelModule);
            const frameDicomDict = {
                meta: {
                    [TRANSFER_SYNTAX_UID]: {
                        vr: 'UI',
                        Value: [EXPLICIT_VR_LITTLE_ENDIAN],
                    },
                },
                dict: {
                    [PIXEL_DATA]: {
                        vr: frameInfo.bitsAllocated > 8 ? 'OW' : 'OB',
                        Value: [decodedPixelData],
                    },
                },
            } as unknown as DicomDict;
            const pixelArray = new ImageReader(
                frameDicomDict,
                frameInfo,
            ).getFrame(1);

            for (const redaction of this.redactions) {
                this._applyRedactionToSingleFrame(
                    pixelArray,
                    redaction,
                    frameInfo,
                );
            }

            const encoder = new Transcoder(
                {
                    ...decodedPixelModule,
                    NumberOfFrames: 1,
                    PixelData: [decodedPixelData],
                },
                TransferSyntax.ExplicitVRLittleEndian,
            );
            encoder.transcode(TransferSyntax.Jpeg2000Lossless);

            const encodedElements = encoder.getElements();
            const encodedPixelModule = this._readPixelModule(encodedElements);
            const encodedFrame = toOwnedArrayBuffer(
                this._getSinglePixelData(encodedElements.PixelData),
            );

            if (outputPixelModule) {
                this._assertSamePixelModule(
                    outputPixelModule,
                    encodedPixelModule,
                );
            } else {
                outputPixelModule = encodedPixelModule;
            }

            if (frameCount === 1) {
                pixelDataElement.Value = [encodedFrame];
            } else {
                fragments[frameIndex] = encodedFrame;
            }
        }

        if (!outputPixelModule) {
            throw new Error('No encoded PixelData frames were produced.');
        }

        this._finalizeEncapsulatedDataset(outputPixelModule);
    }

    private _finalizeEncapsulatedDataset(
        pixelModule: EncodedPixelModule,
    ): void {
        const { dict, meta } = this.dicomDict;
        const pixelDataElement = dict[PIXEL_DATA];

        if (
            !pixelDataElement ||
            !Array.isArray(pixelDataElement.Value) ||
            pixelDataElement.Value.some(
                (frame) => !(frame instanceof ArrayBuffer),
            )
        ) {
            throw new Error(
                'Encoded PixelData must contain ArrayBuffer frames.',
            );
        }

        dict[PIXEL_DATA]!.vr = 'OB';
        dict[PHOTOMETRIC_INTERPRETATION] = {
            vr: 'CS',
            Value: [pixelModule.PhotometricInterpretation],
        };
        dict[BITS_STORED] = {
            vr: 'US',
            Value: [pixelModule.BitsStored],
        };
        dict[HIGH_BIT] = {
            vr: 'US',
            Value: [pixelModule.HighBit],
        };

        if (pixelModule.SamplesPerPixel === 1) {
            delete dict[PLANAR_CONFIGURATION];
        } else {
            if (pixelModule.PlanarConfiguration === undefined) {
                throw new Error(
                    'Encoded pixel module is missing PlanarConfiguration.',
                );
            }

            dict[PLANAR_CONFIGURATION] = {
                vr: 'US',
                Value: [pixelModule.PlanarConfiguration],
            };
        }

        delete dict['7FE00001'];
        delete dict['7FE00002'];
        delete dict['00287FE0'];

        meta[TRANSFER_SYNTAX_UID] = {
            vr: 'UI',
            Value: [TransferSyntax.Jpeg2000Lossless],
        };
        delete meta['00020000'];

        this.imageInfo = ImageReader.readImageInfo(this.dicomDict);
    }

    private _createSourcePixelModule(): EncodedPixelModule {
        const { imageInfo } = this;

        return {
            Rows: imageInfo.rows,
            Columns: imageInfo.columns,
            BitsAllocated: imageInfo.bitsAllocated,
            BitsStored: this._getRequiredTagNumber(BITS_STORED),
            HighBit: this._getRequiredTagNumber(HIGH_BIT),
            SamplesPerPixel: imageInfo.samplesPerPixel,
            PixelRepresentation: Number(imageInfo.signed),
            PhotometricInterpretation: imageInfo.photometricInterpretation,
            PlanarConfiguration: imageInfo.planarConfiguration,
        };
    }

    private _getRequiredTagNumber(address: string): number {
        const value = Utils.getNumberTagValue(this.dicomDict.dict, address);

        if (value === null) {
            throw new Error(`Missing required image attribute ${address}.`);
        }

        return value;
    }

    private _getSinglePixelData(value: unknown): ArrayBuffer | Uint8Array {
        if (Array.isArray(value) && value.length === 1) {
            const pixelData = value[0];
            if (
                pixelData instanceof ArrayBuffer ||
                pixelData instanceof Uint8Array
            ) {
                return pixelData;
            }
        }

        throw new Error('Codec returned an invalid PixelData frame.');
    }

    private _readPixelModule(
        elements: Record<string, unknown>,
    ): EncodedPixelModule {
        const number = (name: string): number => {
            const value = elements[name];
            if (typeof value !== 'number' || !Number.isFinite(value)) {
                throw new Error(`Codec returned an invalid ${name} value.`);
            }
            return value;
        };

        const photometricInterpretation = elements.PhotometricInterpretation;
        if (typeof photometricInterpretation !== 'string') {
            throw new Error(
                'Codec returned an invalid PhotometricInterpretation value.',
            );
        }

        const planarConfiguration = elements.PlanarConfiguration;
        if (
            planarConfiguration !== undefined &&
            typeof planarConfiguration !== 'number'
        ) {
            throw new Error(
                'Codec returned an invalid PlanarConfiguration value.',
            );
        }

        return {
            Rows: number('Rows'),
            Columns: number('Columns'),
            BitsAllocated: number('BitsAllocated'),
            BitsStored: number('BitsStored'),
            HighBit: number('HighBit'),
            SamplesPerPixel: number('SamplesPerPixel'),
            PixelRepresentation: number('PixelRepresentation'),
            PhotometricInterpretation: photometricInterpretation,
            PlanarConfiguration: planarConfiguration,
        };
    }

    private _createImageInfo(pixelModule: EncodedPixelModule): ImageInfo {
        return {
            transferSyntaxUID: EXPLICIT_VR_LITTLE_ENDIAN,
            rows: pixelModule.Rows,
            columns: pixelModule.Columns,
            bitsAllocated: pixelModule.BitsAllocated,
            samplesPerPixel: pixelModule.SamplesPerPixel,
            numberOfFrames: 1,
            photometricInterpretation: pixelModule.PhotometricInterpretation,
            planarConfiguration: pixelModule.PlanarConfiguration ?? 0,
            signed: pixelModule.PixelRepresentation === 1,
        };
    }

    private _assertSamePixelModule(
        expected: EncodedPixelModule,
        actual: EncodedPixelModule,
    ): void {
        if (
            expected.Rows !== actual.Rows ||
            expected.Columns !== actual.Columns ||
            expected.BitsAllocated !== actual.BitsAllocated ||
            expected.BitsStored !== actual.BitsStored ||
            expected.HighBit !== actual.HighBit ||
            expected.SamplesPerPixel !== actual.SamplesPerPixel ||
            expected.PixelRepresentation !== actual.PixelRepresentation ||
            expected.PhotometricInterpretation !==
                actual.PhotometricInterpretation ||
            expected.PlanarConfiguration !== actual.PlanarConfiguration
        ) {
            throw new Error('Inconsistent pixel module between frames.');
        }
    }

    private _applyRedactionToSingleFrame(
        pixelArray: PixelDataTypedArray,
        redaction: RedactionArea,
        frameInfo: Pick<
            ImageInfo,
            'columns' | 'planarConfiguration' | 'rows' | 'samplesPerPixel'
        >,
    ) {
        const { rows, columns, planarConfiguration, samplesPerPixel } =
            frameInfo;

        const { minX, maxX, minY, maxY } = this._getPositionValue(
            redaction,
            rows,
            columns,
        );

        if (planarConfiguration === 0) {
            for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                    const pixelOffset = y * columns + x;
                    const index = pixelOffset * samplesPerPixel;
                    for (let sample = 0; sample < samplesPerPixel; sample++) {
                        pixelArray[index + sample] = 0;
                    }
                }
            }
            return;
        }

        for (let colorIndex = 0; colorIndex < samplesPerPixel; colorIndex++) {
            const colorOffset = colorIndex * rows * columns;
            for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                    const pixelOffset = y * columns + x;
                    const index = pixelOffset + colorOffset;
                    pixelArray[index] = 0;
                }
            }
        }
    }

    private _getPositionValue(
        redaction: RedactionArea,
        rows: number,
        columns: number,
    ) {
        const { x, y, width, height } = redaction;

        const minX = Math.max(0, Math.min(x, x + width - 1));
        const maxX = Math.min(columns - 1, Math.max(x, x + width - 1));
        const minY = Math.max(0, Math.min(y, y + height - 1));
        const maxY = Math.min(rows - 1, Math.max(y, y + height - 1));

        return { minX, maxX, minY, maxY };
    }
}

export default ImageBrush;
