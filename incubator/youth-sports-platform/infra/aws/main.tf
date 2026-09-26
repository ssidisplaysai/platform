data "aws_availability_zones" "available"{state="available"}
resource "aws_vpc" "main"{cidr_block="10.40.0.0/16" enable_dns_hostnames=true enable_dns_support=true}
resource "aws_subnet" "public_a"{vpc_id=aws_vpc.main.id cidr_block="10.40.0.0/24" availability_zone=data.aws_availability_zones.available.names[0] map_public_ip_on_launch=true}
resource "aws_subnet" "public_b"{vpc_id=aws_vpc.main.id cidr_block="10.40.1.0/24" availability_zone=data.aws_availability_zones.available.names[1] map_public_ip_on_launch=true}
resource "aws_subnet" "private_a"{vpc_id=aws_vpc.main.id cidr_block="10.40.10.0/24" availability_zone=data.aws_availability_zones.available.names[0]}
resource "aws_subnet" "private_b"{vpc_id=aws_vpc.main.id cidr_block="10.40.11.0/24" availability_zone=data.aws_availability_zones.available.names[1]}
resource "aws_db_subnet_group" "main"{name="sports-${var.environment}" subnet_ids=[aws_subnet.private_a.id,aws_subnet.private_b.id]}
resource "aws_security_group" "database"{name="sports-db-${var.environment}" vpc_id=aws_vpc.main.id}
resource "aws_db_instance" "postgres"{identifier="sports-${var.environment}" engine="postgres" engine_version="17" instance_class="db.t4g.micro" allocated_storage=20 storage_encrypted=true db_name="sports" username=var.db_username manage_master_user_password=true db_subnet_group_name=aws_db_subnet_group.main.name vpc_security_group_ids=[aws_security_group.database.id] publicly_accessible=false skip_final_snapshot=var.environment=="staging" deletion_protection=var.environment=="production" backup_retention_period=var.environment=="production"?7:1}
resource "aws_s3_bucket" "media"{bucket_prefix="sports-${var.environment}-media-"}
resource "aws_s3_bucket_public_access_block" "media"{bucket=aws_s3_bucket.media.id block_public_acls=true block_public_policy=true ignore_public_acls=true restrict_public_buckets=true}
resource "aws_cognito_user_pool" "users"{name="sports-${var.environment}" username_attributes=["email"] auto_verified_attributes=["email"] password_policy{minimum_length=10 require_lowercase=true require_numbers=true require_symbols=true require_uppercase=true temporary_password_validity_days=3}}
resource "aws_cognito_user_pool_client" "web"{name="sports-web-${var.environment}" user_pool_id=aws_cognito_user_pool.users.id generate_secret=false}
resource "aws_ecr_repository" "api"{name="sports-api-${var.environment}" image_tag_mutability="IMMUTABLE" image_scanning_configuration{scan_on_push=true}}
resource "aws_ecs_cluster" "main"{name="sports-${var.environment}"}
