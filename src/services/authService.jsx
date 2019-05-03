// import { METADATA_OIDC } from "../utils/authConst";
import { UserManager, WebStorageStateStore, Log } from "oidc-client";

export default class AuthService {
  UserManager;
  accessToken;

  constructor() {
    const IDENTITY_CONFIG = {
      // authority: "https://localhost:50005", //(string): The URL of the OIDC provider.
      // client_id: "hello", //(string): Your client application's identifier as registered with the OIDC provider.
      // redirect_uri: process.env.REACT_APP_REDIRECT_URL, //The URI of your client application to receive a response from the OIDC provider.
      // login: process.env.REACT_APP_AUTH_URL + "/login",
      // automaticSilentRenew: false, //(boolean, default: false): Flag to indicate if there should be an automatic attempt to renew the access token prior to its expiration.
      // loadUserInfo: false, //(boolean, default: true): Flag to control if additional identity data is loaded from the user info endpoint in order to populate the user's profile.
      // silent_redirect_uri: process.env.REACT_APP_SILENT_REDIRECT_URL, //(string): The URL for the page containing the code handling the silent renew.
      // post_logout_redirect_uri: process.env.REACT_APP_LOGOFF_REDIRECT_URL, // (string): The OIDC post-logout redirect URI.
      // audience: "https://example.com", //is there a way to specific the audience when making the jwt
      // responseType: "id_token token", //(string, default: 'id_token'): The type of response desired from the OIDC provider.
      // grantType: "password",
      // scope: "openid example.api", //(string, default: 'openid'): The scope being requested from the OIDC provider.
      // webAuthResponseType: "id_token token"
      authority: "https://localhost:50005/",
      client_id: "reactApp",
      redirect_uri: "http://localhost:3000/signin-oidc",
      post_logout_redirect_uri: "http://localhost:3000",
      response_type: "id_token token",
      scope: "openid profile",
      filterProtocolClaims: true,
      loadUserInfo: true
    };

    this.UserManager = new UserManager({
      ...IDENTITY_CONFIG,
      userStore: new WebStorageStateStore({ store: window.localStorage })
      // metadata: {
      //   ...METADATA_OIDC
      // }
    });
    // Logger
    Log.logger = console;
    Log.level = Log.DEBUG;

    this.UserManager.events.addUserLoaded(user => {
      this.accessToken = user.access_token;
      localStorage.setItem("access_token", user.access_token);
      localStorage.setItem("id_token", user.id_token);
      this.setUserInfo({
        accessToken: this.accessToken,
        idToken: user.id_token
      });

      if (window.location.href.indexOf("signin-oidc") !== -1) {
        this.navigateToScreen();
      }
    });
    this.UserManager.events.addSilentRenewError(e => {
      console.log("silent renew error", e.message);
    });

    this.UserManager.events.addAccessTokenExpired(() => {
      console.log("token expired");
      this.signinSilent();
    });
  }

  signinRedirectCallback = () => {
    this.UserManager.signinRedirectCallback().then(() => {
      "";
    });
  };

  getUser = async () => {
    const user = await this.UserManager.getUser();
    if (!user) {
      return await this.UserManager.signinRedirectCallback();
    }
    return user;
  };

  parseJwt = token => {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace("-", "+").replace("_", "/");
    return JSON.parse(window.atob(base64));
  };

  setUserInfo = authResult => {
    const data = this.parseJwt(this.accessToken);

    this.setSessionInfo(authResult);
    this.setUser(data);
  };

  signinRedirect = () => {
    localStorage.setItem("redirectUri", window.location.pathname);
    this.UserManager.signinRedirect({});
  };

  setUser = data => {
    localStorage.setItem("userId", data.sub);
  };

  navigateToScreen = () => {
    const redirectUri = !!localStorage.getItem("redirectUri")
      ? localStorage.getItem("redirectUri")
      : "/en/dashboard";
    // const language = "/" + redirectUri.split("/")[1];

    window.location.replace(redirectUri);
  };

  setSessionInfo(authResult) {
    localStorage.setItem("access_token", authResult.accessToken);
    localStorage.setItem("id_token", authResult.idToken);
  }

  isAuthenticated = () => {
    const access_token = localStorage.getItem("access_token");
    return !!access_token;
  };

  signinSilent = () => {
    this.UserManager.signinSilent()
      .then(user => {
        console.log("signed in", user);
      })
      .catch(err => {
        console.log(err);
      });
  };
  signinSilentCallback = () => {
    this.UserManager.signinSilentCallback();
  };

  createSigninRequest = () => {
    return this.UserManager.createSigninRequest();
  };

  setCookie = (name, value, options) => {
    options = options || {};
    let expires = options.expires;
    if (typeof expires === "number" && expires) {
      const d = new Date();
      d.setTime(d.getTime() + expires * 1000);
      expires = options.expires = d;
    }
    if (expires && expires.toUTCString) {
      options.expires = expires.toUTCString();
    }
    value = encodeURIComponent(value);
    let updatedCookie = name + "=" + value;
    options.forEach(propName => {
      updatedCookie += "; " + propName;
      const propValue = options[propName];
      if (propValue !== true) {
        updatedCookie += "=" + propValue;
      }
    });
    document.cookie = updatedCookie;
  };

  deleteCookies = names => {
    for (let i = 0; i < names.lenght; i++) {
      this.setCookie(names[i], "", {
        expires: -1
      });
    }
  };

  logout = () => {
    this.UserManager.signoutRedirect({
      id_token_hint: localStorage.getItem("id_token")
    });
    this.UserManager.clearStaleState();
  };

  signoutRedirectCallback = () => {
    this.UserManager.signoutRedirectCallback().then(() => {
      localStorage.clear();
      this.deleteCookies(["idsrv.session"]);
      window.location.replace(process.env.REACT_APP_PUBLIC_URL);
    });
    this.UserManager.clearStaleState();
  };
}
