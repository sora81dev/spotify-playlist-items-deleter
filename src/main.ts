import { serve } from "@hono/node-server";
import axios from "axios";
import { Hono } from "hono";
import env from "dotenv";

env.config();

const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;
const redirect_uri = process.env.REDIRECT_URI;
const redirect_uri_path = process.env.REDIRECT_URI_PATH;
const playlist_id = process.env.PLAYLIST_ID;

if (!client_id) {
  console.error("[ERROR] You don't set CLIENT_ID environment");
}

if (!client_secret) {
  console.error("[ERROR] You don't set CLIENT_SECRET environment");
}

if (!redirect_uri) {
  console.error("[ERROR] You don't set REDIRECT_URI environment");
}

if (!redirect_uri_path) {
  console.error("[ERROR] You don't set REDIRECT_URI_PATH environment");
}

if (!playlist_id) {
  console.error("[ERROR] You don't set PLAYLIST_ID environment");
}

let code = "";

async function getAccessToken() {
  const response = await axios.post(
    "https://accounts.spotify.com/api/token",
    null,
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      auth: {
        username: String(client_id),
        password: String(client_secret),
      },
      params: {
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirect_uri,
      },
    },
  );

  return { at: response.data.access_token, rt: response.data.refresh_token };
}

let access_token = "";
let refresh_token = "";

const hono = new Hono();

hono.get("/api/v1/delete_playlist", async (c) => {
  const response = await axios.get(
    `https://api.spotify.com/v1/playlists/${playlist_id}/items`,
    {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    },
  );

  const items = response.data.items;
  const result = [];

  for (let i = 0; i < Math.min(items.length, 100); i++) {
    const trackId = items[i].item.id;
    if (trackId) {
      result.push({ uri: `spotify:track:${trackId}` });
    }
  }

  const response2 = await axios.delete(
    `https://api.spotify.com/v1/playlists/${playlist_id}/items`,
    {
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      data: {
        items: result,
      },
    },
  );

  return c.json(response2.data);
});

hono.get("/api/v1/auth", async (c) => {
  return c.redirect(
    `https://accounts.spotify.com/authorize?client_id=${client_id}&response_type=code&redirect_uri=${redirect_uri}&scope=playlist-modify-private%20playlist-read-private`,
    301,
  );
});

hono.get(`/${redirect_uri_path}`, async (c) => {
  if (!c.req.query("code")) return c.status(400);
  code = String(c.req.query("code"));

  getAccessToken().then((token) => {
    access_token = token.at;
    refresh_token = token.rt;
  });

  return c.text("success", 200);
});

serve(hono);
