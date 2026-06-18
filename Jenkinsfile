pipeline {
    agent none
    options { skipDefaultCheckout() }

    stages {
        stage('Checkout SCM') {
            agent {
                label 'lynx'
            }

            environment {
                HOME = "${env.WORKSPACE}"
            }

            steps {
                sh 'rm -Rf .git'
                checkout scm
            }
        }

        stage('Install dependencies') {
            agent {
                docker {
                    image 'oven/bun:1.2.21-alpine'
                    label 'lynx'
                }
            }

            environment {
                HOME = "${env.WORKSPACE}"
            }

            steps {
                echo "installing dependencies for build ${env.BRANCH_NAME}-${env.BUILD_ID}"
                sh 'bun install --frozen-lockfile'
            }
        }

        stage('Build') {
            agent {
                docker {
                    image 'oven/bun:1.2.21-alpine'
                    label 'lynx'
                }
            }

            environment {
                HOME = "${env.WORKSPACE}"
            }

            steps {
                sh 'bun run build'
            }
        }

        stage('Typecheck') {
            agent {
                docker {
                    image 'oven/bun:1.2.21-alpine'
                    label 'lynx'
                }
            }

            environment {
                HOME = "${env.WORKSPACE}"
            }

            steps {
                sh 'bun run typecheck'
            }
        }

        stage('Lint') {
            agent {
                docker {
                    image 'oven/bun:1.2.21-alpine'
                    label 'lynx'
                }
            }

            environment {
                HOME = "${env.WORKSPACE}"
            }

            steps {
                sh 'bun run lint'
            }
        }

        stage('Test') {
            agent {
                docker {
                    image 'oven/bun:1.2.21-alpine'
                    label 'lynx'
                }
            }

            environment {
                HOME = "${env.WORKSPACE}"
            }

            steps {
                sh 'bun run test'
            }
        }
    }
}
