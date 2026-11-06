// noinspection ES6PreferShortImport
import type { Dict } from '../types/@types/dcmjs';

export const IMPLICIT_VR_LITTLE_ENDIAN = '1.2.840.10008.1.2';
export const EXPLICIT_VR_LITTLE_ENDIAN = '1.2.840.10008.1.2.1';
export const DEFLATED_EXPLICIT_VR_LITTLE_ENDIAN = '1.2.840.10008.1.2.1.99';
export const EXPLICIT_VR_BIG_ENDIAN = '1.2.840.10008.1.2.2';

export const TRANSFER_SYNTAX_UID = '00020010';
export const ROWS = '00280010';
export const COLUMNS = '00280011';
export const BITS_ALLOCATED = '00280100';
export const SAMPLES_PER_PIXEL = '00280002';
export const PIXEL_REPRESENTATION = '00280103';
export const NUMBER_OF_FRAMES = '00280008';
export const PHOTOMETRIC_INTERPRETATION = '00280004';
export const PLANAR_CONFIGURATION = '00280006';

export const FLOAT_PIXEL_DATA = '7FE00008';
export const PIXEL_DATA = '7FE00010';

const getStringTagValue = (dict: Dict, address: string): string | null => {
    const valueElement = dict[address]?.Value?.[0];

    if (typeof valueElement !== 'string') {
        return null;
    }

    return valueElement;
};

const getNumberTagValue = (dict: Dict, address: string): number | null => {
    const valueElement = dict[address]?.Value?.[0];

    let value: number;

    if (typeof valueElement === 'string') {
        value = Number(valueElement);
    } else if (typeof valueElement === 'number') {
        value = valueElement;
    } else {
        return null;
    }

    return value;
};

export default {
    getStringTagValue,
    getNumberTagValue,
};
