// Create the main myMSALObj instance
// configuration parameters are located at authConfig.js
const myMSALObj = new msal.PublicClientApplication(msalConfig);

let accountId = "";
let username = "";

function selectAccount() {

    // Ah, nice idea! If you want to go this route I would also recommend checking clientId and 
    // authority match and then also that there aren't more than 1 user signed into this authority/policy.

    // Another way to do this would be to track the homeAccountId after retrieving tokens and use the getAccountByHomeId API 
    // or use the setActiveAccount/getActiveAccount APIs.

    /**
     * See here for more info on account retrieval: 
     * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-common/docs/Accounts.md
     */

    const currentAccounts = myMSALObj.getAllAccounts();

    if (currentAccounts.length < 1) {
        return;
    } else if (currentAccounts.length === Object.entries(b2cPolicies.names).length) {

        /**
         * Due to the way MSAL caches account objects, the auth response from initiating a user-flow
         * is cached as a new account. Here we make sure we are selecting the account with homeAccountId
         * that contains the sign-up/sign-in user-flow, as this is the default flow we initially signed-in with.
         */
        const accounts = currentAccounts.filter(account =>
            account.homeAccountId.toUpperCase().includes(b2cPolicies.names.signUpSignIn.toUpperCase())
            &&
            account.homeAccountId.includes(account.localAccountId)
        );

        if (accounts.length > 1) {
            if (accounts.every(account => account.localAccountId === accounts[0].localAccountId)) {
                accountId = accounts[0].homeAccountId;
                username = accounts[0].username;
                welcomeUser(username);
            } else {
                signOut();
            };
        } else if (accounts.length === 1) {
            accountId = accounts[0].homeAccountId;
            username = accounts[0].username;
            welcomeUser(username);
        }

    } else if (currentAccounts.length === 1) {
        accountId = currentAccounts[0].homeAccountId;
        username = currentAccounts[0].username;
        welcomeUser(username);
    }
}

// in case of page refresh
selectAccount();

function handleResponse(response) {
    /**
     * To see the full list of response object properties, visit:
     * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/request-response-object.md#response
     */

    if (response !== null) {
        accountId = response.account.homeAccountId;
        username = response.account.username;
        welcomeUser(username);
    } else {
        selectAccount();
    }
}

function signIn() {

    /**
     * You can pass a custom request object below. This will override the initial configuration. For more information, visit:
     * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/request-response-object.md#request
     */

    myMSALObj.loginPopup(loginRequest)
        .then(handleResponse)
        .catch(error => {
            console.log(error);
        });
}

function signOut() {

    /**
     * You can pass a custom request object below. This will override the initial configuration. For more information, visit:
     * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/request-response-object.md#request
     */

    const logoutRequest = {
        postLogoutRedirectUri: msalConfig.auth.redirectUri,
        mainWindowRedirectUri: msalConfig.auth.redirectUri
    };

    myMSALObj.logoutPopup(logoutRequest);
}

function getTokenPopup(request) {

    /**
    * See here for more information on account retrieval: 
    * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-common/docs/Accounts.md
    */
    request.account = myMSALObj.getAccountByHomeId(accountId);


    /**
     * 
     */
    return myMSALObj.acquireTokenSilent(request)
        .then((response) => {
            // In case the response from B2C server has an empty accessToken field
            // throw an error to initiate token acquisition
            if (!response.accessToken || response.accessToken === "") {
                throw new msal.InteractionRequiredAuthError;
            }
            return response;
        })
        .catch(error => {
            console.log("Silent token acquisition fails. Acquiring token using popup. \n", error);
            if (error instanceof msal.InteractionRequiredAuthError) {
                // fallback to interaction when silent call fails
                return myMSALObj.acquireTokenPopup(request)
                    .then(response => {
                        console.log(response);
                        return response;
                    }).catch(error => {
                        console.log(error);
                    });
            
            if (error instanceof msal.BrowserAuthError) {

            }

            } else {
                console.log(error);
            }
        });
}

function passTokenToApi() {
    getTokenPopup(tokenRequest)
        .then(response => {
            if (response) {
                console.log("access_token acquired at: " + new Date().toString());
                try {
                    callApi(apiConfig.webApi, response.accessToken);
                } catch (error) {
                    console.log(error);
                }
            }
        });
}

/**
 * To initiate a B2C user-flow, simply make a login request using
 * the full authority string of that user-flow e.g.
 * https://fabrikamb2c.b2clogin.com/fabrikamb2c.onmicrosoft.com/B2C_1_edit_profile_v2 
 */
function editProfile() {
    myMSALObj.loginPopup(b2cPolicies.authorities.editProfile)
        .catch(error => {
            console.log(error);
        });
}
