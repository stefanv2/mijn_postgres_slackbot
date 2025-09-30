# postgres-container/Dockerfile
FROM postgres:16

# (optioneel) timezone via ENV of .env
ENV TZ=Europe/Amsterdam
