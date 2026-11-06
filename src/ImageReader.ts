import Utils, {
    BITS_ALLOCATED,
    COLUMNS,
    DEFLATED_EXPLICIT_VR_LITTLE_ENDIAN,
    EXPLICIT_VR_BIG_ENDIAN,
    EXPLICIT_VR_LITTLE_ENDIAN,
    FLOAT_PIXEL_DATA,
    IMPLICIT_VR_LITTLE_ENDIAN,
    NUMBER_OF_FRAMES,
    PHOTOMETRIC_INTERPRETATION,
    PIXEL_DATA,
    PIXEL_REPRESENTATION,
    PLANAR_CONFIGURATION,
    ROWS,
    SAMPLES_PER_PIXEL,
    TRANSFER_SYNTAX_UID,
} from './Utils';

import { constants } from 'dcmjs-codecs';

import type { ImageInfo, PixelDataTypedArray } from '../types';
// noinspection ES6PreferShortImport
import type { DicomDict } from '../types/@types/dcmjs';

class ImageReader {
    private readonly byteArray: Uint8Array;
    private readonly imageInfo: ImageInfo;

    private readonly vr: 'OB' | 'OF' | 'OW';

    public constructor(dicomDict: DicomDict, imageInfo: ImageInfo) {
        if (!ImageReader.isNativeTransferSyntax(imageInfo.transferSyntaxUID)) {
            throw new Error('Unsupported transfer syntax');
        }

        this.imageInfo = imageInfo;

        const pixelData = dicomDict.dict[PIXEL_DATA];
        if (pixelData && pixelData.Value && pixelData.Value[0]) {
            this.byteArray = this._toUint8Array(pixelData.Value[0]);
            this.vr = this.imageInfo.bitsAllocated > 8 ? 'OW' : 'OB';
        } else {
            const floatPixelData = dicomDict.dict[FLOAT_PIXEL_DATA];
            if (
                floatPixelData &&
                floatPixelData.Value &&
                floatPixelData.Value[0]
            ) {
                this.byteArray = this._toUint8Array(floatPixelData.Value[0]);
                this.vr = 'OF';
            } else {
                throw new Error('Pixel data not found');
            }
        }
    }

    public static normalisePhotometricInterpretation(dicomDict: DicomDict) {
        const photometricInterpretation =
            dicomDict.dict[PHOTOMETRIC_INTERPRETATION];
        if (photometricInterpretation && photometricInterpretation?.Value) {
            const value =
                (photometricInterpretation?.Value?.[0] as string | undefined) ??
                '';

            for (const interpretation of Object.values(
                constants.PhotometricInterpretation,
            )) {
                if (value.startsWith(interpretation)) {
                    dicomDict.dict['00280004'] = {
                        vr: 'CS',
                        Value: [interpretation],
                    };
                    return;
                }
            }

            throw new Error('Invalid photometric interpretation');
        }
    }

    public static readTransferSyntaxUID(dicomDict: DicomDict): string {
        const transferSyntaxUID =
            dicomDict.meta[TRANSFER_SYNTAX_UID]?.Value?.[0];

        if (typeof transferSyntaxUID !== 'string') {
            throw new Error('Invalid transfer syntax UID');
        }

        return transferSyntaxUID;
    }

    public static isNativeTransferSyntax(
        transferSyntaxUIDOrDicomDict: DicomDict | string,
    ): boolean {
        let transferSyntaxUID: string;
        if (typeof transferSyntaxUIDOrDicomDict === 'string') {
            transferSyntaxUID = transferSyntaxUIDOrDicomDict;
        } else {
            transferSyntaxUID = ImageReader.readTransferSyntaxUID(
                transferSyntaxUIDOrDicomDict,
            );
        }

        return (
            transferSyntaxUID === IMPLICIT_VR_LITTLE_ENDIAN ||
            transferSyntaxUID === EXPLICIT_VR_LITTLE_ENDIAN ||
            transferSyntaxUID === DEFLATED_EXPLICIT_VR_LITTLE_ENDIAN ||
            transferSyntaxUID === EXPLICIT_VR_BIG_ENDIAN
        );
    }

    public static readImageInfo(dicomDict: DicomDict): ImageInfo {
        const { dict } = dicomDict;

        const transferSyntaxUID = ImageReader.readTransferSyntaxUID(dicomDict);
        const rows = Utils.getNumberTagValue(dict, ROWS);
        const columns = Utils.getNumberTagValue(dict, COLUMNS);
        const bitsAllocated = Utils.getNumberTagValue(dict, BITS_ALLOCATED);
        const samplesPerPixel = Utils.getNumberTagValue(
            dict,
            SAMPLES_PER_PIXEL,
        );
        const pixelRepresentation = Utils.getNumberTagValue(
            dict,
            PIXEL_REPRESENTATION,
        );
        const photometricInterpretation = Utils.getStringTagValue(
            dict,
            PHOTOMETRIC_INTERPRETATION,
        );
        const numberOfFrames = Utils.getNumberTagValue(dict, NUMBER_OF_FRAMES);
        const planarConfiguration = Utils.getNumberTagValue(
            dict,
            PLANAR_CONFIGURATION,
        );

        if (
            !transferSyntaxUID ||
            !rows ||
            !columns ||
            !bitsAllocated ||
            !samplesPerPixel ||
            !photometricInterpretation
        ) {
            throw new Error('Missing pixel data information', {
                cause: JSON.stringify({
                    transferSyntaxUID,
                    rows,
                    columns,
                    bitsAllocated,
                    samplesPerPixel,
                    pixelRepresentation,
                }),
            });
        }

        return {
            transferSyntaxUID,
            rows,
            columns,
            bitsAllocated,
            samplesPerPixel,
            numberOfFrames: numberOfFrames ?? 1,
            photometricInterpretation,
            planarConfiguration: planarConfiguration ?? 0,
            signed: pixelRepresentation === 1,
        };
    }

    public getFrame(index: number): PixelDataTypedArray {
        if (index < 1 || index > this.imageInfo.numberOfFrames) {
            throw new Error('Invalid frame index');
        }

        const frame = this._extractFrame(index - 1);

        if (this._isNativeLittleOrBigEndian(this.imageInfo.transferSyntaxUID)) {
            return this._getLittleEndianFramePixelData(frame);
        }

        return this._getBigEndianFramePixelData(frame);
    }

    public getVR(): 'OB' | 'OF' | 'OW' {
        return this.vr;
    }

    private _toUint8Array(value: unknown): Uint8Array {
        if (value instanceof Uint8Array) {
            return value;
        }

        if (ArrayBuffer.isView(value)) {
            return new Uint8Array(
                value.buffer,
                value.byteOffset,
                value.byteLength,
            );
        }

        if (value instanceof ArrayBuffer) {
            return new Uint8Array(value);
        }

        throw new Error('Invalid pixel data format');
    }

    /**
     * This function is a modified version of `getUncompressedImageFrame` from cornerstonejs `wadouri` image loader.
     * https://github.com/cornerstonejs/cornerstone3D/blob/4cd423bc8a4340447ff8ee37e34b9455ab6bf51d/packages/dicomImageLoader/src/imageLoader/wadouri/getUncompressedImageFrame.ts#L8
     *
     * The original source code is licenced under the MIT licence.
     *
     * @param index
     * @private
     */
    private _extractFrame(index: number): Uint8Array {
        let samplesPerPixel = this.imageInfo.samplesPerPixel;

        if (
            this.imageInfo.photometricInterpretation ===
            constants.PhotometricInterpretation.YbrFull422
        ) {
            samplesPerPixel = 2;
            console.warn(
                'Using SamplesPerPixel of 2 for YBR_FULL_422 photometric interpretation.' +
                    ' See https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_C.7.6.3.html for more information.',
            );
        }

        const pixelsPerFrame =
            this.imageInfo.rows * this.imageInfo.columns * samplesPerPixel;

        if (this.imageInfo.bitsAllocated === 8) {
            const offset = index * pixelsPerFrame;
            const length = pixelsPerFrame;
            if (offset + length > this.byteArray.length) {
                throw new Error('frame exceeds size of pixelData');
            }

            return this.byteArray.subarray(offset, offset + length);
        }

        if (this.imageInfo.bitsAllocated === 16) {
            const offset = index * pixelsPerFrame * 2;
            const length = pixelsPerFrame * 2;
            if (offset + length > this.byteArray.length) {
                throw new Error('frame exceeds size of pixelData');
            }

            return this.byteArray.subarray(offset, offset + length);
        }

        if (this.imageInfo.bitsAllocated === 32) {
            const offset = index * pixelsPerFrame * 4;
            const length = pixelsPerFrame * 4;
            if (offset + length > this.byteArray.length) {
                throw new Error('frame exceeds size of pixelData');
            }

            return this.byteArray.subarray(offset, offset + length);
        }

        throw new Error('unsupported pixel format');
    }

    /**
     * Determines whether the native byte order for the provided transfer syntax UID
     * is little-endian or big-endian.
     *
     * @param transferSyntaxUID The UID of the transfer syntax to check.
     * @return Returns `true` if the transfer syntax is little-endian, `false` if it is big-endian.
     * @throws Throws an error if the provided transfer syntax UID is unknown.
     */
    private _isNativeLittleOrBigEndian(transferSyntaxUID: string): boolean {
        if (
            transferSyntaxUID === IMPLICIT_VR_LITTLE_ENDIAN ||
            transferSyntaxUID === EXPLICIT_VR_LITTLE_ENDIAN ||
            transferSyntaxUID === DEFLATED_EXPLICIT_VR_LITTLE_ENDIAN
        ) {
            return true;
        }

        if (transferSyntaxUID === EXPLICIT_VR_BIG_ENDIAN) {
            return false;
        }

        throw new Error(`Unknown transfer syntax UID: ${transferSyntaxUID}`);
    }

    private _getLittleEndianFramePixelData(
        frame: Uint8Array,
    ): PixelDataTypedArray {
        if (this.imageInfo.bitsAllocated === 8) {
            return frame;
        }

        if (this.imageInfo.bitsAllocated === 16) {
            if (this.imageInfo.signed) {
                return new Int16Array(
                    frame.buffer,
                    frame.byteOffset,
                    frame.byteLength / 2,
                );
            }

            return new Uint16Array(
                frame.buffer,
                frame.byteOffset,
                frame.byteLength / 2,
            );
        }

        if (this.imageInfo.bitsAllocated === 32) {
            return new Float32Array(
                frame.buffer,
                frame.byteOffset,
                frame.byteLength / 4,
            );
        }

        throw new Error('unsupported pixel format');
    }

    private _getBigEndianFramePixelData(
        frame: Uint8Array,
    ): PixelDataTypedArray {
        if (this.imageInfo.bitsAllocated === 16) {
            if (this.imageInfo.signed) {
                return new Int16Array(
                    frame.buffer,
                    frame.byteOffset,
                    frame.byteLength / 2,
                );
            }

            return new Uint16Array(
                frame.buffer,
                frame.byteOffset,
                frame.byteLength / 2,
            );
        }

        if (this.imageInfo.bitsAllocated === 8) {
            return frame;
        }

        throw new Error('unsupported pixel format');
    }
}

export default ImageReader;
