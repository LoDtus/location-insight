import {
    combineReducers,
    configureStore,
    createAction,
    type Action,
} from "@reduxjs/toolkit";
import {
    FLUSH,
    PAUSE,
    PERSIST,
    persistReducer,
    persistStore,
    PURGE,
    REGISTER,
    REHYDRATE,
} from "redux-persist";
import type { Storage } from "redux-persist";
import storage from "redux-persist/lib/storage";

import preferenceReducer, {
    PREFERENCE,
} from "@/features/preference/preference.slice";
import authReducer from "@/features/auth/auth.slice";

const noopStorage: Storage = {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
};

const persistStorage: Storage =
    typeof window === "undefined" ? noopStorage : storage;

const preferencePersistConfig = {
    key: PREFERENCE.PERSIST_KEY,
    storage: persistStorage,
    whitelist: ["theme", "lang"],
};

const reducers = combineReducers({
    preference: persistReducer(preferencePersistConfig, preferenceReducer),
    auth: authReducer,
});

export type RootReducerState = ReturnType<typeof reducers>;

export const resetAppState = createAction<{
    keepPreference: boolean;
}>("store/reset");

function rootReducer(
    state: RootReducerState | undefined,
    action: Action,
): RootReducerState {
    if (resetAppState.match(action)) {
        const fresh = reducers(undefined, action);
        // Đặt lại = đăng xuất: auth về "anonymous" luôn, không để "unknown" kích hoạt khôi phục phiên vừa thu hồi.
        const nextState: RootReducerState = { ...fresh, auth: { ...fresh.auth, status: "anonymous" } };

        if (action.payload.keepPreference && state?.preference) {
            return {
                ...nextState,
                preference: state.preference,
            };
        }

        return nextState;
    }

    return reducers(state, action);
}

export const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                ignoredActions: [
                    FLUSH,
                    REHYDRATE,
                    PAUSE,
                    PERSIST,
                    PURGE,
                    REGISTER,
                    resetAppState.type,
                ],
            },
        }),
});

export const persistor = persistStore(store);

export type AppStore = typeof store;
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
