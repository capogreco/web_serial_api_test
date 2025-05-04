import { serveDir } from "jsr:@std/http/file-server";

const fsRoot = "public"
const options = { 
    port: 8000,
    hostname: "localhost",
    onListen: () => console.log (`Listening on http://localhost:8000`)
}

Deno.serve (options, r => serveDir (r, { fsRoot }))
