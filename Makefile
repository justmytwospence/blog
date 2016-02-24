SHELL := /bin/bash

all: \
public/CNAME \
public/static/css/style.min.css \
public/static/js/main.min.js

public/static/css/style.min.css: vendor/bootstrap/less/bootstrap.less ./vendor/rrssb/css/rrssb.css ./static/css/*.css
	mkdir -p $(@D)
	yuicompressor --type css -o $@ <(cat <(lessc $<) $(filter-out $<,$^))

public/static/js/main.min.js: ./vendor/rrssb/js/rrssb.js ./vendor/bootstrap/dist/js/bootstrap.js
	mkdir -p $(@D)
	yuicompressor --type js -o $@ <(cat $^)

public/CNAME: static/CNAME
	cp $< $@
