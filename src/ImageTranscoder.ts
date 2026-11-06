import ImageReader from './ImageReader';

// @ts-expect-error
import { data } from 'dcmjs';
import { NativeCodecs, constants, Transcoder } from 'dcmjs-codecs';

import type { DicomDict, Dict } from '../types/@types/dcmjs';

const { TransferSyntax } = constants;

class ImageTranscoder {
    private readonly dicomDict: DicomDict;
    private readonly transferSyntaxUID: string;
    private readonly transcoder: Transcoder;

    public constructor(dicomDict: DicomDict) {
        this.dicomDict = dicomDict;

        ImageReader.normalisePhotometricInterpretation(this.dicomDict);

        this.transferSyntaxUID = ImageReader.readTransferSyntaxUID(
            this.dicomDict,
        );

        this.transcoder = this._createTranscoder();
    }

    public static async init(opts?: {
        dcmjsWebAssemblyModulePathOrUrl?: string;
        logCodecsInfo?: boolean;
        logCodecsTrace?: boolean;
    }): Promise<void> {
        await NativeCodecs.initializeAsync({
            webAssemblyModulePathOrUrl: opts?.dcmjsWebAssemblyModulePathOrUrl,
            logCodecsInfo: opts?.logCodecsInfo,
            logCodecsTrace: opts?.logCodecsTrace,
        });
    }

    public transcode(
        targetTransferSyntaxUID: string,
        params?: {
            quality?: number;
            allowedLossyError?: number;
            progressionOrder?: string;
            rate?: number;
        },
    ): DicomDict {
        this.transcoder.transcode(targetTransferSyntaxUID, params);

        const dataset = this.transcoder.getElements();

        if (!dataset._vrMap) {
            dataset._vrMap = {
                PixelData: (dataset.BitsAllocated as number) <= 8 ? 'OB' : 'OW',
            };
        }

        const newDicomData = data.DicomMetaDictionary.denaturalizeDataset(
            dataset,
        ) as Dict;

        const originalDicomData = this.dicomDict.dict;

        for (const [address, value] of Object.entries(newDicomData)) {
            originalDicomData[address] = value;
        }

        // Extended Offset Table
        delete originalDicomData['7FE00001'];

        // Extended Offset Table Lengths
        delete originalDicomData['7FE00002'];

        // Pixel Data Provider URL
        delete originalDicomData['00287FE0'];

        /*
         * Planar Configuration :
         * à supprimer si Samples Per Pixel vaut 1.
         */
        const samplesPerPixel = originalDicomData['00280002']?.Value?.[0];

        if (Number(samplesPerPixel) === 1) {
            delete originalDicomData['00280006'];
        }

        /*
         * Number of Frames :
         * à supprimer si absent dans le résultat du transcodeur
         * ou si le résultat représente une seule frame.
         */
        const numberOfFrames = originalDicomData['00280008']?.Value?.[0];

        if (numberOfFrames === undefined || Number(numberOfFrames) === 1) {
            delete originalDicomData['00280008'];
        }

        /*
         * La Transfer Syntax se trouve dans le File Meta Information,
         * pas dans dicomDict.dict.
         */
        this.dicomDict.meta['00020010'] = {
            vr: 'UI',
            Value: [targetTransferSyntaxUID],
        };

        /*
         * La longueur du groupe meta doit être recalculée par dcmjs.
         */
        delete this.dicomDict.meta['00020000'];

        return this.dicomDict;
    }

    public unpack(): DicomDict {
        return this.transcode(TransferSyntax.ImplicitVRLittleEndian);
    }

    public pack(): DicomDict {
        return this.transcode(TransferSyntax.Jpeg2000Lossless);
    }

    private _getPixelDataFrames(
        pixelData: unknown,
    ): Array<ArrayBuffer | Uint8Array> {
        if (pixelData instanceof ArrayBuffer) {
            return [pixelData];
        }

        if (pixelData instanceof Uint8Array) {
            return [pixelData];
        }

        if (Array.isArray(pixelData)) {
            return pixelData.map((frame) => {
                if (
                    frame instanceof ArrayBuffer ||
                    frame instanceof Uint8Array
                ) {
                    return frame;
                }

                throw new Error('Format de PixelData non supporté.');
            });
        }

        throw new Error(
            'PixelData introuvable ou dans un format non supporté.',
        );
    }

    private _createTranscoder(): Transcoder {
        const dataset = data.DicomMetaDictionary.naturalizeDataset(
            this.dicomDict.dict,
        );

        if (!dataset.PixelData) {
            throw new Error('Le fichier DICOM ne contient pas de PixelData.');
        }

        const pixels = this._getPixelDataFrames(dataset.PixelData);

        return new Transcoder(
            {
                Rows: Number(dataset.Rows),
                Columns: Number(dataset.Columns),
                BitsStored: Number(dataset.BitsStored),
                BitsAllocated: Number(dataset.BitsAllocated),
                HighBit: Number(dataset.HighBit),
                SamplesPerPixel: Number(dataset.SamplesPerPixel),
                PixelRepresentation: Number(dataset.PixelRepresentation),
                PhotometricInterpretation: String(
                    dataset.PhotometricInterpretation,
                ),
                PlanarConfiguration:
                    dataset.PlanarConfiguration === undefined
                        ? undefined
                        : Number(dataset.PlanarConfiguration),
                NumberOfFrames:
                    dataset.NumberOfFrames === undefined
                        ? undefined
                        : Number(dataset.NumberOfFrames),
                PixelData: pixels,
            },
            this.transferSyntaxUID,
        );
    }
}

export default ImageTranscoder;
