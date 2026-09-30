variable "aws_region"{type=string default="us-west-2"}
variable "environment"{type=string default="staging" validation{condition=contains(["staging","production"],var.environment) error_message="environment must be staging or production."}}
variable "db_username"{type=string default="sports_admin"}
