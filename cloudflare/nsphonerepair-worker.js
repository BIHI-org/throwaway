// Cloudflare Worker: serves the NS Cellphone Store POS at https://nsphonerepair.ca
// The files stay on GitHub Pages (web/ns/ in this repo); this passes each request through,
// so nsphonerepair.ca/anything shows bihi-org.github.io/throwaway/ns/anything.
// Setup: Cloudflare → Workers & Pages → Create → Worker → paste this → Deploy,
// then Settings → Domains & Routes → Add → Custom domain: nsphonerepair.ca (and www.nsphonerepair.ca).
const ORIGIN = 'https://bihi-org.github.io/throwaway/ns';
const DOMAIN = 'nsphonerepair.ca';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.hostname !== DOMAIN) {                     // www. and anything else → the main address
      url.hostname = DOMAIN; url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }
    const res = await fetch(new Request(ORIGIN + url.pathname + url.search, request), { redirect: 'manual' });
    const loc = res.headers.get('location');
    if (!loc) return res;
    // GitHub redirects (e.g. a folder without the final slash) must point back at this domain.
    const fixed = new URL(loc, ORIGIN + url.pathname);
    const prefix = '/throwaway/ns';
    const path = fixed.hostname.endsWith('github.io') && fixed.pathname.startsWith(prefix)
      ? fixed.pathname.slice(prefix.length) || '/' : null;
    const headers = new Headers(res.headers);
    if (path !== null) headers.set('location', 'https://' + DOMAIN + path + fixed.search);
    return new Response(res.body, { status: res.status, headers });
  },
};
