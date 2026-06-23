import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api, setToken } from '../../../services/api';
import { APP, DEMO } from '../../../utils/constants';

export const loginAsync = createAsyncThunk('auth/login', async ({ email, password }, { rejectWithValue }) => {
  try {
    const res = await api.auth.login(email, password);
    setToken(res.accessToken);
    return res;
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState: { user: null, token: null, isAuthenticated: false, loading: false, error: null },
  reducers: {
    loginSuccess(state, action) {
      state.user = action.payload.user;
      state.token = action.payload.accessToken;
      state.isAuthenticated = true;
      state.loading = false;
      state.error = null;
    },
    loginDemo(state) {
      state.user = DEMO.USER;
      state.token = APP.DEMO_TOKEN;
      state.isAuthenticated = true;
      state.loading = false;
      setToken(APP.DEMO_TOKEN);
    },
    logout(state) { state.user = null; state.token = null; state.isAuthenticated = false; setToken(null); },
    setLoading(state, action) { state.loading = action.payload; },
    setError(state, action) { state.error = action.payload; state.loading = false; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginAsync.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(loginAsync.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.token = action.payload.accessToken;
        state.isAuthenticated = true;
        state.loading = false;
      })
      .addCase(loginAsync.rejected, (state, action) => {
        state.error = action.payload;
        state.loading = false;
      });
  },
});

export const { loginSuccess, loginDemo, logout, setLoading, setError } = authSlice.actions;
export default authSlice.reducer;
