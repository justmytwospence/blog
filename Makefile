SHELL := /bin/bash

all: public/CNAME public/static/css/style.min.css public/static/js/main.min.js

public/static/css/style.min.css: static/css/bootstrap.css
	mkdir -p public/static/css
	yuicompressor --type css -o $@ <(cat ./vendor/rrssb/css/rrssb.css ./static/css/*.css)

public/static/js/main.min.js:
	mkdir -p public/static/js
	yuicompressor --type js -o $@ <(cat ./vendor/rrssb/js/rrssb.js ./vendor/bootstrap/dist/js/bootstrap.js)

static/css/bootstrap.css:
	lessc vendor/bootstrap/less/bootstrap.less $@

public/CNAME:
	mv static/CNAME $@
