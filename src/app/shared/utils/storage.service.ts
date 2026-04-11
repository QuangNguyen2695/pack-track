import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';

@Injectable({
  providedIn: 'root'
})
export class StorageService {

  private _storage: Storage | null = null;

  constructor(private storage: Storage) {
    this.init();
  }

  async init() {
    const store = await this.storage.create();
    this._storage = store;
  }

  // lưu dữ liệu
  async set(key: string, value: any) {
    return await this._storage?.set(key, value);
  }

  // lấy dữ liệu
  async get(key: string) {
    return await this._storage?.get(key);
  }

  // xóa key
  async remove(key: string) {
    return await this._storage?.remove(key);
  }

  // xóa toàn bộ
  async clear() {
    return await this._storage?.clear();
  }

}