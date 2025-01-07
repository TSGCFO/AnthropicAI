import pkg_resources

# Packages in requirements.in
requirements = """
asgiref
black
build
certifi
cffi
chardet
charset-normalizer
click
colorama
contourpy
coverage
cryptography
cssselect2
cycler
decorator
dj-database-url
django-classy-tags
django-cms
django-crispy-forms
django-filer
django-formtools
django-js-asset
django-mptt
django-polymorphic
django-sekizai
django-treebeard
djangocms-admin-style
djangocms-attributes-field
djangocms-bootstrap4
djangocms-file
djangocms-googlemap
djangocms-icon
djangocms-installer
djangocms-link
djangocms-picture
djangocms-style
djangocms-text-ckeditor
djangocms-video
easy-thumbnails
et-xmlfile
fonttools
greenlet
html5lib
idna
isodate
Jinja2
kiwisolver
lxml
MarkupSafe
matplotlib
mpld3
mypy-extensions
nose2
numpy
openpyxl
packaging
pandas
pathspec
pillow
pip
pip-tools
platformdirs
psycopg2
pycparser
pyparsing
pyproject_hooks
python-dateutil
pytz
reportlab
requests
self
setuptools
six
SQLAlchemy
sqlalchemy-views
sqlparse
svglib
tabulate
tinycss2
typing_extensions
tzdata
tzlocal
urllib3
utils
webencodings
wheel
XlsxWriter
"""

# Parse the requirements
required_packages = set(requirements.splitlines())

# Get installed packages
installed_packages = {pkg.key for pkg in pkg_resources.working_set}

# Find missing packages
missing_packages = required_packages - installed_packages

if missing_packages:
    print(f"Missing packages: {', '.join(missing_packages)}")
else:
    print("No missing packages!")