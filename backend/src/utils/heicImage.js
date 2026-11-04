import { Worker } from 'node:worker_threads';
let activeConversions = 0;

export function convertHeicImage(buffer) {
  if (activeConversions >= 2) {
    return Promise.reject(Object.assign(new Error('Conversion de photos occupée. Réessaie dans quelques secondes.'), { statusCode: 503, publicMessage: 'Conversion de photos occupée. Réessaie dans quelques secondes.' }));
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./heicImageWorker.js', import.meta.url), {
      workerData: buffer, execArgv: [], resourceLimits: { maxOldGenerationSizeMb: 256 },
    });
    activeConversions++;
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      activeConversions--;
      clearTimeout(timer);
      worker.terminate();
      if (error) reject(Object.assign(new Error(error), { statusCode: 400 }));
      else resolve(Buffer.from(result));
    };
    const timer = setTimeout(() => finish('La conversion a pris trop de temps. Essaie une photo JPG.'), 25000);
    worker.once('message', result => finish(result.error, result.buffer));
    worker.once('error', () => finish('Cette photo HEIC n’a pas pu être convertie. Essaie une photo JPG.'));
    worker.once('exit', () => { if (!settled) finish('La conversion de cette photo a été interrompue. Réessaie avec un JPG.'); });
  });
}
