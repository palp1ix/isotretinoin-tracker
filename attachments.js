const DATABASE_NAME = 'isotretinoin-files-v1';
const STORE_NAME = 'pdfs';
let databasePromise;

function openDatabase() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('Локальное хранилище вложений недоступно в этом браузере.'));
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Не удалось открыть хранилище PDF.'));
      request.onblocked = () => reject(new Error('Хранилище PDF занято другой вкладкой. Закройте её и повторите.'));
    });
  }
  return databasePromise;
}

async function runRequest(mode, callback) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = callback(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Не удалось обработать PDF-файл.'));
    transaction.onabort = () => reject(transaction.error || new Error('Операция с PDF была отменена.'));
  });
}

export function savePdf(id, blob, name) {
  return runRequest('readwrite', (store) => store.put({ id, blob, name, savedAt: Date.now() }));
}

export function getPdf(id) {
  return runRequest('readonly', (store) => store.get(id));
}

export function deletePdf(id) {
  return runRequest('readwrite', (store) => store.delete(id));
}

export function clearPdfs() {
  return runRequest('readwrite', (store) => store.clear());
}

export async function pdfToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error || new Error('Не удалось прочитать PDF для резервной копии.'));
    reader.readAsDataURL(blob);
  });
}

export function pdfFromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: 'application/pdf' });
}
