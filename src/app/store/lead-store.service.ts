import { computed, inject, Injectable, signal } from '@angular/core';
import {
  Firestore,
  CollectionReference,
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from '@angular/fire/firestore';
import { IResponse } from '../models/response';
import { paramsJsonParse } from '../utils/functions-utils';
import { Observable, firstValueFrom, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class LeadStoreService {
  #firestore = inject(Firestore);
  #collectionRef: CollectionReference = collection(this.#firestore, 'leads');

  #state = signal<any[]>([]);
  #loading = signal<boolean>(false);

  select = {
    state: computed(() => this.#state()),
    loading: computed(() => this.#loading()),
    one: (id: string) => this.#extractOne(id),
  };

  constructor() {}

  actionLoadAll() {
    return new Promise<IResponse>((resolve) => {
      let response: IResponse = {
        error: true,
        results: undefined,
        message: 'Ocorreu um error ao obter itens.',
      };
      this.#loading.set(true);
      let results: any[] = [];

      getDocs(this.#collectionRef)
        .then((res) => {
          res.forEach(async (doc) => {
            await results.push(doc.data());
          });

          response = {
            error: false,
            results,
            message: 'Sucesso ao obter itens.',
          };
          this.#setInState(response);
          this.#loading.set(false);
          resolve(response);
        })
        .catch(() => {
          this.#loading.set(false);
          resolve(response);
        });
    });
  }

  actionSave(item: any) {
    const res$ = new Observable<IResponse>((observer) => {
      this.#loading.set(true);
      let response: IResponse = {};
      let ref: any;
      let newItem: any;
      if (item?.id) {
        ref = doc(this.#collectionRef, item.id);
        newItem = { ...item, id: ref.id, created_at: new Date().toISOString() };
        updateDoc(ref, newItem)
          .then(() => {
            response = {
              error: false,
              results: newItem,
              message: 'Item atualizado com sucesso!',
            };
            this.#setInState(response);
            observer.next(response);
          })
          .catch((err) => {
            console.error(err);
            response = {
              error: true,
              results: undefined,
              message:
                'Ocorreu um error ao tentar atualizar o item. Tente novamente!',
            };
            observer.next(response);
          });
      } else {
        ref = doc(this.#collectionRef);
        newItem = { ...item, id: ref.id, created_at: new Date().toISOString() };

        setDoc(ref, newItem)
          .then(() => {
            response = {
              error: false,
              results: newItem,
              message: 'Salvo com sucesso.',
            };
            observer.next(response);
          })
          .catch((err) => {
            console.error(err);
            observer.next(response);
          });
      }
    });

    return firstValueFrom(
      res$.pipe(
        tap((res) => {
          this.#loading.set(false);
          this.#setInState(res);
        })
      )
    );
  }

  actionRemove(id: string) {
    return new Promise<IResponse>((resolve) => {
      let response: IResponse = {
        error: true,
        results: undefined,
        message: 'Ocorreu um error ao remover item.',
      };
      this.#loading.set(true);
      const ref = doc(this.#collectionRef, id);

      deleteDoc(ref)
        .then((res) => {
          this.#loading.set(false);
          response = {
            error: false,
            results: { id },
            message: 'Item deletado com sucesso!',
          };
          this.#state.update((current) =>
            current.filter((elem) => elem.id !== id)
          );
          resolve(response);
        })
        .catch((err) => {
          this.#loading.set(false);
          console.error(err);
          resolve(response);
        });
    });
  }

  #extractOne(id: string) {
    return computed(() => this.#state().find((elem) => elem.id === id));
  }

  #setInState(res: IResponse, replaceAll = false) {
    const { error, results } = res;
    if (error) {
      return;
    }
    const entity: any[] = Array.isArray(results) ? results : [results];
    this.#state.update((current) => {
      if (replaceAll) {
        return entity.map((elem) => paramsJsonParse(elem));
      } else {
        // Evita duplicações baseadas no ID
        const entityMap = new Map(entity.map((item) => [item.id, item]));
        // Atualiza os itens existentes e adiciona os novos
        const updatedList = (current ?? []).map(
          (item) => entityMap.get(item.id) || item
        );
        const existingIds = new Set(updatedList.map((item) => item.id));
        const newItems = entity.filter((item) => !existingIds.has(item.id));
        const res: any[] = [...updatedList, ...newItems].map((elem) =>
          paramsJsonParse(elem)
        );
        return res;
      }
    });
  }
}
