# Lambda image for the pipeline. Poppler gives us pdftotext.
FROM public.ecr.aws/lambda/python:3.12
RUN dnf install -y poppler-utils && dnf clean all
COPY vachan ${LAMBDA_TASK_ROOT}/vachan
