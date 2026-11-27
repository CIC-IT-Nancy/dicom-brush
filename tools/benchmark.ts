import { ImageBrush, ImageReader, ImageTranscoder } from '../src';

import { data } from 'dcmjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const FILE = process.argv[2];

if (!FILE) {
    console.error(
        'Usage: node --expose-gc --import tsx benchmark.ts <file.dcm>',
    );
    process.exit(1);
}

interface Snapshot {
    name: string;
    timestamp: string;
    durationMs: number;

    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
}

const snapshots: Snapshot[] = [];

function formatMb(value: number): string {
    return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function gc() {
    globalThis.gc?.();
}

function memorySnapshot(name: string, startTime: number): Snapshot {
    gc();

    const mem = process.memoryUsage();

    const snapshot: Snapshot = {
        name,
        timestamp: new Date().toISOString(),
        durationMs: performance.now() - startTime,

        rss: mem.rss,
        heapTotal: mem.heapTotal,
        heapUsed: mem.heapUsed,
        external: mem.external,
        arrayBuffers: mem.arrayBuffers,
    };

    snapshots.push(snapshot);

    console.log('');
    console.log(`==== ${name} ====`);
    console.log(`Duration: ${snapshot.durationMs.toFixed(0)} ms`);
    console.log(`RSS          : ${formatMb(snapshot.rss)}`);
    console.log(`Heap Total   : ${formatMb(snapshot.heapTotal)}`);
    console.log(`Heap Used    : ${formatMb(snapshot.heapUsed)}`);
    console.log(`External     : ${formatMb(snapshot.external)}`);
    console.log(`ArrayBuffers : ${formatMb(snapshot.arrayBuffers)}`);

    if (snapshots.length > 1) {
        const previous = snapshots[snapshots.length - 2];

        const delta = snapshot.rss - previous.rss;

        console.log(`RSS delta    : ${formatMb(delta)}`);
    }

    return snapshot;
}

async function main() {
    console.log('');
    console.log('===================================');
    console.log(' DICOM MEMORY BENCHMARK');
    console.log('===================================');
    console.log('');

    gc();

    let step = performance.now();

    await ImageTranscoder.init();

    memorySnapshot('startup', step);

    //
    // Read file
    //
    step = performance.now();

    const dicomBuffer = fs.readFileSync(FILE);

    memorySnapshot('file loaded', step);

    //
    // Parse DICOM
    //
    step = performance.now();

    const dicomDict = data.DicomMessage.readFile(
        dicomBuffer.buffer.slice(
            dicomBuffer.byteOffset,
            dicomBuffer.byteOffset + dicomBuffer.byteLength,
        ),
    );

    memorySnapshot('dicom parsed', step);

    //
    // Read metadata
    //
    step = performance.now();

    const imageInfo = ImageReader.readImageInfo(dicomDict);
    const sourceWasEncapsulated = !ImageReader.isNativeTransferSyntax(
        imageInfo.transferSyntaxUID,
    );

    memorySnapshot('image info read', step);

    console.log('');
    console.log('Image info');
    console.log(imageInfo);

    //
    // Create brush
    //
    step = performance.now();

    const brush = new ImageBrush(dicomDict);

    memorySnapshot('brush created', step);

    //
    // Apply small redaction
    //
    step = performance.now();

    brush.addRedactionArea({
        x: 0,
        y: 0,
        width: 128,
        height: 128,
    });

    brush.apply();

    memorySnapshot('redaction applied', step);

    const outputDicomDict = brush.getDicomDict();
    const outputImageInfo = ImageReader.readImageInfo(outputDicomDict);

    console.log('');
    console.log(
        `Output Transfer Syntax UID: ${outputImageInfo.transferSyntaxUID}`,
    );

    //
    // Pack again
    //
    let packed;
    if (!sourceWasEncapsulated) {
        step = performance.now();

        packed = new ImageTranscoder(outputDicomDict).pack();

        memorySnapshot('repacked', step);
    }

    //
    // Release references
    //
    step = performance.now();

    void packed;

    gc();

    memorySnapshot('post gc', step);

    //
    // Save report
    //
    const report = {
        file: FILE,
        imageInfo,
        outputTransferSyntaxUID: outputImageInfo.transferSyntaxUID,
        snapshots,
    };

    const reportPath = path.resolve(`benchmark-${Date.now()}.json`);

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('');
    console.log(`Report written to ${reportPath}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
