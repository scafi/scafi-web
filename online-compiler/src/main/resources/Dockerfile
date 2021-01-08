# Alpine Linux with OpenJDK JRE
FROM java:8
# copy WAR into image
COPY ./online-compiler.jar /online-compiler.jar 
# run application with this command line
WORKDIR /
EXPOSE 8080 
CMD /usr/bin/java -jar -Xmx2G -Xss256M /online-compiler.jar
