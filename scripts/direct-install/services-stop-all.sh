#!/bin/bash

# Stop all services for specified modules

source ./scripts/direct-install/install-config.sh

if $ENABLE_INDEXER; then
    systemctl --user stop indexer-xrp.service
    systemctl --user stop indexer-btc.service
    systemctl --user stop indexer-doge.service
fi

if $INSTALL_VERIFIER; then
    systemctl --user stop verifier-xrp
    systemctl --user stop verifier-btc
    systemctl --user stop verifier-doge
fi

if $ENABLE_MONITOR; then
    systemctl --user stop attester-alerts
fi

if $INSTALL_FLARE; then
    systemctl --user stop flare-attester-client.service
    systemctl --user stop flare-webserver.service
fi

if $INSTALL_SONGBIRD; then
    systemctl --user stop songbird-attester-client.service
    systemctl --user stop songbird-webserver.service
fi

if $INSTALL_COSTON; then
    systemctl --user stop coston-attester-client.service
    systemctl --user stop coston-webserver.service
fi

if $INSTALL_COSTON2; then
    systemctl --user stop coston2-attester-client.service
    systemctl --user stop coston2-webserver.service
fi

# systemctl --user stop coston-spammer-btc.service
# systemctl --user stop coston-spammer-ltc.service
# systemctl --user stop coston-spammer-xrp.service
# systemctl --user stop coston-spammer-algo.service
# systemctl --user stop coston-spammer-doge.service
