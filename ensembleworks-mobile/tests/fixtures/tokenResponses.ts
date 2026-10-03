export const tokenResponses = {
  success: { status: 200, body: '{"enabled":true,"token":"signed-fixture-token","url":"wss://canvas.example/livekit"}' },
  disabled: { status: 200, body: '{"enabled":false}' },
  redirect: { status: 302, body: '', redirected: false },
  followedRedirect: { status: 200, body: '<html>Cloudflare Access login</html>', redirected: true },
  loginHtml: { status: 200, body: '<!DOCTYPE html><html>Sign in</html>', contentType: 'text/html' },
  malformedJson: { status: 200, body: '{broken' },
  missingToken: { status: 200, body: '{"enabled":true,"url":"wss://canvas.example/livekit"}' },
  unavailable: { status: 503, body: '{"error":"unavailable"}' },
};
