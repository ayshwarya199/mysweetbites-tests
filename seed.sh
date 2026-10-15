#!/bin/sh
set -e
mkdir -p /var/www/html/wp-content/mu-plugins
echo '<?php add_filter("pre_wp_mail", "__return_true");' > /var/www/html/wp-content/mu-plugins/no-mail.php

# wait for WordPress files and the database
until [ -f /var/www/html/wp-config.php ]; do sleep 2; done
until wp db query "SELECT 1" >/dev/null 2>&1; do sleep 3; done

if wp core is-installed 2>/dev/null; then
  echo "Already seeded"; exit 0
fi

# site + WooCommerce
wp core install --url=http://localhost:8080 --title="mysweetbites" \
  --admin_user=admin --admin_password=admin --admin_email=admin@example.com --skip-email
wp rewrite structure '/%postname%/' --hard
wp theme install storefront --activate
wp plugin install woocommerce --activate
wp wc tool run install_pages --user=admin

# store settings (EUR, Dutch format, open to visitors)
wp option update woocommerce_currency EUR
wp option update woocommerce_price_decimal_sep ','
wp option update woocommerce_price_thousand_sep '.'
wp option update woocommerce_default_country NL
wp option update woocommerce_coming_soon no
wp option update woocommerce_store_pages_only no

# products
wp wc product create --name="Chocolate Sprinkles (Hagelslag)" --slug=chocolate-sprinkles-hagelslag --type=simple --regular_price=2.25 --user=admin
wp wc product create --name="Mint Candies" --slug=mint-candies --type=simple --regular_price=1.95 --user=admin
wp wc product create --name="Gummy Bears / Mixed Candy Bag" --slug=gummy-bears-mixed-candy-bag --type=simple --regular_price=2.75 --user=admin
wp wc product create --name="seasonal gift set" --slug=seasonal-gift-set --type=simple --regular_price=14.95 --user=admin

DROSTE=$(wp wc product create --name="Droste Chocolate Bars" --slug=droste-chocolate-bars --type=variable \
  --attributes='[{"name":"size","visible":true,"variation":true,"options":["Small","Medium","Large"]}]' \
  --user=admin --porcelain)
wp wc product_variation create $DROSTE --regular_price=4.50  --attributes='[{"name":"size","option":"Small"}]'  --user=admin
wp wc product_variation create $DROSTE --regular_price=7.95  --attributes='[{"name":"size","option":"Medium"}]' --user=admin
wp wc product_variation create $DROSTE --regular_price=11.95 --attributes='[{"name":"size","option":"Large"}]'  --user=admin

# coupon: 10% off, minimum spend 22
wp wc shop_coupon create --code=WELCOME10 --discount_type=percent --amount=10 --minimum_amount=22 --user=admin

# Cash on Delivery
wp option update woocommerce_cod_settings '{"enabled":"yes","title":"Cash on delivery","description":"Pay with cash upon delivery.","instructions":"Pay with cash upon delivery.","enable_for_methods":[],"enable_for_virtual":"yes"}' --format=json

# shipping: flat rate 4,75 for the Netherlands
wp eval '
$zone = new WC_Shipping_Zone();
$zone->set_zone_name("Netherlands");
$zone->add_location("NL", "country");
$zone->save();
$instance_id = $zone->add_shipping_method("flat_rate");
update_option("woocommerce_flat_rate_" . $instance_id . "_settings", array(
  "title" => "Flat rate",
  "tax_status" => "none",
  "cost" => "4.75",
));
'