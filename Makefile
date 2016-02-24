SHELL := /bin/bash

all: public/CNAME public/static/css/style.min.css public/static/js/main.min.js

public/static/css/style.min.css:
	mkdir -p public/static/css
	yuicompressor --type css -o $@ <(cat ./vendor/rrssb/css/rrssb.css ./static/css/*.css <(lessc vendor/bootstrap/less/bootstrap.less))

public/static/js/main.min.js:
	mkdir -p public/static/js
	yuicompressor --type js -o $@ <(cat ./vendor/rrssb/js/rrssb.js ./vendor/bootstrap/dist/js/bootstrap.js)

public/CNAME:
	cp static/CNAME $@
