import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api, setToken, setRefreshToken } from '../../../services/api';
import { APP, DEMO } from '../../../utils/constants';

const STORAGE_KEY_TOKEN = 'atheris_token';
const STORAGE_KEY_REFRESH = 'atheris_refresh_token';
const STORAGE_KEY_USER = 'atheris_user';

function loadFromStorage() {
  try {
    const token = localStorage.getItem(STORAGE_KEY_TOKEN);
    const refreshToken = localStorage.getItem(STORAGE_KEY_REFRESH);
    const user = JSON.parse(localStorage.getItem(STORAGE_KEY_USER) || 'null');
    if (token && user) {
      setToken(token);
      if (refreshToken) setRefreshToken(refreshToken);
      return { user, token, refreshToken, isAuthenticated: true, loading: false, error: null };
    }
  } catch {}
  return { user: null, token: null, refreshToken: null, isAuthenticated: false, loading: false, error: null };
}

function saveToStorage(token, refreshToken, user) {
  try {
    if (token) localStorage.setItem(STORAGE_KEY_TOKEN, token);
    else localStorage.removeItem(STORAGE_KEY_TOKEN);
    if (refreshToken) localStorage.setItem(STORAGE_KEY_REFRESH, refreshToken);
    else localStorage.removeItem(STORAGE_KEY_REFRESH);
    if (user) localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY_USER);
  } catch {}
}

export const loginAsync = createAsyncThunk('auth/login', async ({ email, password }, { rejectWithValue }) => {
  try {
    const res = await api.auth.login(email, password);
    setToken(res.accessToken);
    if (res.refreshToken) setRefreshToken(res.refreshToken);
    saveToStorage(res.accessToken, res.refreshToken, res.user);
    return res;
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const refreshTokenAsync = createAsyncThunk('auth/refresh', async (_, { getState, rejectWithValue }) => {
  try {
    const refreshToken = getState().auth.refreshToken;
    if (!refreshToken) throw new Error('No refresh token');
    const res = await api.auth.refresh(refreshToken);
    setToken(res.accessToken);
    if (res.refreshToken) setRefreshToken(res.refreshToken);
    saveToStorage(res.accessToken, res.refreshToken, res.user);
    return res;
  } catch (err) {
    saveToStorage(null, null, null);
    setToken(null);
    setRefreshToken(null);
    return rejectWithValue(err.message);
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState: loadFromStorage(),
  reducers: {
    loginSuccess(state, action) {
      state.user = action.payload.user;
      state.token = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.isAuthenticated = true;
      state.loading = false;
      state.error = null;
      setToken(action.payload.accessToken);
      if (action.payload.refreshToken) setRefreshToken(action.payload.refreshToken);
      saveToStorage(action.payload.accessToken, action.payload.refreshToken, action.payload.user);
    },
    loginDemo(state) {
      state.user = DEMO.USER;
      state.token = APP.DEMO_TOKEN;
      state.isAuthenticated = true;
      state.loading = false;
      setToken(APP.DEMO_TOKEN);
      saveToStorage(APP.DEMO_TOKEN, null, DEMO.USER);
    },
    logout(state) {
      state.user = null; state.token = null; state.refreshToken = null; state.isAuthenticated = false;
      setToken(null); setRefreshToken(null);
      saveToStorage(null, null, null);
    },
    setLoading(state, action) { state.loading = action.payload; },
    setError(state, action) { state.error = action.payload; state.loading = false; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginAsync.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(loginAsync.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.token = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.isAuthenticated = true;
        state.loading = false;
      })
      .addCase(loginAsync.rejected, (state, action) => {
        state.error = action.payload;
        state.loading = false;
      })
      .addCase(refreshTokenAsync.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.token = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.isAuthenticated = true;
      })
      .addCase(refreshTokenAsync.rejected, (state) => {
        state.user = null; state.token = null; state.refreshToken = null; state.isAuthenticated = false;
      });
  },
});

export const { loginSuccess, loginDemo, logout, setLoading, setError } = authSlice.actions;
export default authSlice.reducer;
