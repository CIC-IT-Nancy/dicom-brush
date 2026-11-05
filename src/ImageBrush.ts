import type { DicomDict } from '~/types/@types/dcmjs';
import type {
    ImageInfo,
    PixelDataTypedArray,
    RedactionArea,
} from '~/types/index';

import ImageReader from '~/ImageReader';
import ImageTranscoder from '~/ImageTranscoder';
import { FLOAT_PIXEL_DATA, PIXEL_DATA } from '~/Utils';

class ImageBrush {
    private readonly dicomDict: DicomDict;
    private readonly imageInfo: ImageInfo;

    private readonly redactions: RedactionArea[];

    private locked: boolean;

    public constructor(dicomDict: DicomDict) {
        if (ImageReader.isNativeTransferSyntax(dicomDict)) {
            this.dicomDict = dicomDict;
        } else {
            const transcoder = new ImageTranscoder(dicomDict);
            this.dicomDict = transcoder.unpack();
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

    public async apply(): Promise<void> {
        if (this.locked) {
            throw new Error('Redaction already applied');
        }

        this.locked = true;
        await this._applyPixelDataRedaction();
    }

    public getDicomDict(): DicomDict {
        if (!this.locked) {
            throw new Error('Redaction not applied');
        }

        return this.dicomDict;
    }

    private async _applyPixelDataRedaction(): Promise<void> {
        const frameBuffers: Blob[] = [];
        const imageReader = new ImageReader(this.dicomDict, this.imageInfo);

        for (
            let frameIndex = 1;
            frameIndex <= this.imageInfo.numberOfFrames;
            frameIndex++
        ) {
            const pixelArray = await imageReader.getFrame(frameIndex);

            for (const redaction of this.redactions) {
                this._applyRedactionToSingleFrame(pixelArray, redaction);
            }

            frameBuffers.push(
                new Blob([this._ensureEvenLength(pixelArray)], {
                    type: 'application/octet-stream',
                }),
            );
        }

        const vr = imageReader.getVR();

        delete this.dicomDict.dict[FLOAT_PIXEL_DATA];
        delete this.dicomDict.dict[PIXEL_DATA];

        if (vr === 'OF') {
            this.dicomDict.dict[FLOAT_PIXEL_DATA] = {
                vr: 'OF',
                Value: [await this._concatFramesBuffer(frameBuffers)],
            };
            return;
        }

        this.dicomDict.dict[PIXEL_DATA] = {
            vr: vr,
            Value: [await this._concatFramesBuffer(frameBuffers)],
        };
    }

    private _applyRedactionToSingleFrame(
        pixelArray: PixelDataTypedArray,
        redaction: RedactionArea,
    ) {
        const { rows, columns, planarConfiguration, samplesPerPixel } =
            this.imageInfo;

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

    private _ensureEvenLength(value: PixelDataTypedArray): ArrayBuffer {
        const bytes = this._toExactUint8Array(value);

        if (bytes.byteLength % 2 === 0) {
            return bytes.buffer.slice(
                bytes.byteOffset,
                bytes.byteOffset + bytes.byteLength,
            );
        }

        const padded = new Uint8Array(bytes.byteLength + 1);
        padded.set(bytes);
        padded[padded.length - 1] = 0;

        return padded.buffer;
    }

    private _toExactUint8Array(
        value: PixelDataTypedArray,
    ): Uint8Array<ArrayBuffer> {
        return new Uint8Array(value.slice(0));
    }

    private async _concatFramesBuffer(frames: Blob[]): Promise<ArrayBuffer> {
        const result = new Blob(frames, {
            type: 'application/octet-stream',
        });

        return result.arrayBuffer();
    }
}

export default ImageBrush;
