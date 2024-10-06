FROM ubuntu

ENTRYPOINT [ "/bin/sh" ]
CMD ["-c", "for i in `seq 1 1000000`; do echo This is log number $i and were still not done; done" ]