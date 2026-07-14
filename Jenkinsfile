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
                    image 'node:24-alpine'
                    label 'lynx'
                }
            }

            environment {
                HOME = "${env.WORKSPACE}"
            }

            steps {
                echo "installing dependencies for build ${env.BRANCH_NAME}-${env.BUILD_ID}"
                sh 'corepack enable'
                sh 'pnpm install --frozen-lockfile'
            }
        }

        stage('Build') {
            agent {
                docker {
                    image 'node:24-alpine'
                    label 'lynx'
                }
            }

            environment {
                HOME = "${env.WORKSPACE}"
            }

            steps {
                sh 'corepack enable'
                sh 'pnpm run build'
            }
        }

        stage('Typecheck') {
            agent {
                docker {
                    image 'node:24-alpine'
                    label 'lynx'
                }
            }

            environment {
                HOME = "${env.WORKSPACE}"
            }

            steps {
                sh 'corepack enable'
                sh 'pnpm run typecheck'
            }
        }

        stage('Lint') {
            agent {
                docker {
                    image 'node:24-alpine'
                    label 'lynx'
                }
            }

            environment {
                HOME = "${env.WORKSPACE}"
            }

            steps {
                sh 'corepack enable'
                sh 'pnpm run lint'
            }
        }

        stage('Test') {
            agent {
                docker {
                    image 'node:24-alpine'
                    label 'lynx'
                }
            }

            environment {
                HOME = "${env.WORKSPACE}"
            }

            steps {
                sh 'corepack enable'
                sh 'pnpm run test'
            }
        }
    }
}
