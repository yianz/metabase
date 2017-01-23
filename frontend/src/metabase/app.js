/* @flow weak */

import React from 'react'
import ReactDOM from 'react-dom'
import { ApolloProvider } from 'react-apollo';

import MetabaseAnalytics, { registerAnalyticsClickListener } from "metabase/lib/analytics";
import MetabaseSettings from "metabase/lib/settings";

import api from "metabase/lib/api";

import { getRoutes } from "./routes.jsx";
import { getStore } from './store'

import { refreshSiteSettings } from "metabase/redux/settings";

import { Router, browserHistory } from "react-router";
import { push, syncHistoryWithStore } from 'react-router-redux'

import ApolloClient, { createNetworkInterface } from 'apollo-client';

function init() {
    const client = new ApolloClient({
      networkInterface: createNetworkInterface({
          uri: "/api/graphql",
          opts: { credentials: 'same-origin' }
      }),
    });
    const store = getStore(browserHistory, client);
    const routes = getRoutes(store);
    const history = syncHistoryWithStore(browserHistory, store);

    ReactDOM.render(
        <ApolloProvider store={store} client={client} >
          <Router history={history}>
            {routes}
          </Router>
        </ApolloProvider>
    , document.getElementById('root'));

    // listen for location changes and use that as a trigger for page view tracking
    history.listen(location => {
        MetabaseAnalytics.trackPageView(location.pathname);
    });

    registerAnalyticsClickListener();

    store.dispatch(refreshSiteSettings());

    // enable / disable GA based on opt-out of anonymous tracking
    MetabaseSettings.on("anon_tracking_enabled", () => {
        window['ga-disable-' + MetabaseSettings.get('ga_code')] = MetabaseSettings.isTrackingEnabled() ? null : true;
    });

    // received a 401 response
    api.on("401", () => {
        store.dispatch(push("/auth/login"));
    });

    // we shouldn't redirect these URLs because we want to handle them differently
    let WHITELIST_FORBIDDEN_URLS = [
        /api\/card\/\d+\/query$/,
        /api\/database\/\d+\/metadata$/
    ];
    // received a 403 response
    api.on("403", (url) => {
        if (url) {
            for (const regex of WHITELIST_FORBIDDEN_URLS) {
                if (regex.test(url)) {
                    return;
                }
            }
        }
        store.dispatch(push("/unauthorized"));
    });
}

if (document.readyState != 'loading') {
    init();
} else {
    document.addEventListener('DOMContentLoaded', init);
}
