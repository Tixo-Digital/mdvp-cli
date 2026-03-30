import { get as httpsGet, request as httpsRequest } from 'https'
import { get as httpGet, request as httpRequest } from 'http'

const API = "https://api.mdvp.dev"

function pickModule(url) {
  return url.startsWith("http://") ? { get: httpGet, request: httpRequest } : { get: httpsGet, request: httpsRequest }
}

function apiGet(path, baseUrl = API) {
  const { get } = pickModule(baseUrl)
  return new Promise((resolve, reject) => {
    get(`${baseUrl}${path}`, { headers: { Accept: "application/json" } }, (res) => {
      let body = ""
      res.on("data", (c) => (body += c))
      res.on("end", () => {
        try { resolve(JSON.parse(body)) }
        catch { reject(new Error(`Invalid JSON: ${body.slice(0, 200)}`)) }
      })
    }).on("error", reject)
  })
}

function apiPost(path, data, apiKey, baseUrl = API) {
  const { request } = pickModule(baseUrl)
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data)
    const req = request(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(apiKey ? { "x-api-key": apiKey } : {}),
      },
    }, (res) => {
      let resp = ""
      res.on("data", (c) => (resp += c))
      res.on("end", () => {
        try { resolve(JSON.parse(resp)) }
        catch { reject(new Error(`Invalid JSON: ${resp.slice(0, 200)}`)) }
      })
    })
    req.on("error", reject)
    req.write(body)
    req.end()
  })
}

export { API, pickModule, apiGet, apiPost }
