import { data } from 'dcmjs';

import fs from 'node:fs';

const FILE = './test.dcm';

const dicomBuffer = fs.readFileSync(FILE);

const dicomDict = data.DicomMessage.readFile(
    dicomBuffer.buffer.slice(
        dicomBuffer.byteOffset,
        dicomBuffer.byteOffset + dicomBuffer.byteLength,
    ),
);

const dataset = data.DicomMetaDictionary.naturalizeDataset(dicomDict.dict);

console.log(dataset);
