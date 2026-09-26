output "database_endpoint"{value=aws_db_instance.postgres.address sensitive=true}
output "media_bucket"{value=aws_s3_bucket.media.bucket}
output "cognito_user_pool_id"{value=aws_cognito_user_pool.users.id}
output "cognito_web_client_id"{value=aws_cognito_user_pool_client.web.id}
output "api_ecr_repository_url"{value=aws_ecr_repository.api.repository_url}
output "ecs_cluster_name"{value=aws_ecs_cluster.main.name}
