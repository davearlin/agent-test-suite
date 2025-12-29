import asyncio
import time
import json
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

try:
    from google.cloud import dialogflowcx_v3beta1 as df
    from google.cloud.dialogflowcx_v3beta1 import SessionsClient, AgentsClient, FlowsClient, PagesClient
    from google.cloud.dialogflowcx_v3beta1 import DetectIntentRequest, QueryInput, TextInput, QueryParameters, DetectIntentResponse
    from google.cloud.dialogflowcx_v3beta1.services.playbooks import PlaybooksClient
    from google.api_core import exceptions as gcp_exceptions
    from google.api_core.client_options import ClientOptions
    from google.auth import default
    from google.auth.exceptions import DefaultCredentialsError
    from google.oauth2.credentials import Credentials
    from google.protobuf.json_format import MessageToDict
except ImportError as e:
    raise ImportError(
        "Google Cloud Dialogflow libraries are required but not installed. "
        "This application cannot run without proper Google Cloud dependencies. "
        f"Original error: {e}"
    )

from app.core.config import settings
from app.core.token_manager import TokenManager
from app.models import User

# Cache for agent discovery to improve performance
# Format: {(user_id, project_id): {"agents": [...], "timestamp": timestamp, "ttl": 3600}}
_agent_cache = {}
_cache_ttl = 3600  # 1 hour

# Cache for agent permission checks to avoid repeated API calls
# Format: {(user_id, agent_name): {"accessible": bool, "timestamp": timestamp, "ttl": 3600}}
_permission_cache = {}
_permission_cache_ttl = 3600  # 1 hour


class DialogflowService:
    def __init__(self, user: Optional[User] = None, db: Optional[Session] = None, project_id: Optional[str] = None):
        self.project_id = project_id or settings.GOOGLE_CLOUD_PROJECT
        self.user = user
        self.db = db
        
        # Validate required parameters
        if not self.user:
            raise ValueError("User must be provided for Dialogflow operations")
        if not self.db:
            raise ValueError("Database session must be provided for Dialogflow operations")
        if not self.project_id:
            raise ValueError("Google Cloud project ID must be configured")
        
        # Initialize Dialogflow clients with user credentials
        self._initialize_clients()
    
    def _convert_protobuf_to_dict(self, obj: Any) -> Any:
        """
        Recursively convert protobuf objects to native Python types.
        
        Args:
            obj: Protobuf object or native type
            
        Returns:
            Native Python type (dict, list, str, number, bool, None)
        """
        # Handle None
        if obj is None:
            return None
        
        # Try MessageToDict first for protobuf messages with DESCRIPTOR
        try:
            if hasattr(obj, 'DESCRIPTOR'):
                return MessageToDict(obj)
        except Exception as e:
            print(f"⚠️ MessageToDict with DESCRIPTOR failed: {e}")
        
        # Handle proto.marshal wrapped objects - these need special handling
        obj_type_str = str(type(obj))
        if 'proto.marshal' in obj_type_str:
            print(f"🔍 Converting proto.marshal object: {obj_type_str}")
            
            # For MapComposite - try multiple conversion strategies
            if 'MapComposite' in obj_type_str:
                try:
                    result = {}
                    
                    # Strategy 1: Try dict() conversion directly
                    try:
                        result = dict(obj)
                        if result:
                            print(f"✅ Converted MapComposite via dict() with {len(result)} keys")
                            # Recursively convert nested values
                            for key in list(result.keys()):
                                result[key] = self._convert_protobuf_to_dict(result[key])
                            return result
                    except Exception as e:
                        print(f"⚠️ dict() conversion failed: {e}")
                    
                    # Strategy 2: Access _pb attribute if available
                    if hasattr(obj, '_pb'):
                        try:
                            result = MessageToDict(obj._pb)
                            if result:
                                print(f"✅ Converted MapComposite via _pb with {len(result)} keys")
                                return result
                        except Exception as e:
                            print(f"⚠️ _pb conversion failed: {e}")
                    
                    # Strategy 3: Try to iterate as dict
                    if hasattr(obj, 'keys'):
                        keys = list(obj.keys())
                        print(f"🔍 MapComposite has {len(keys)} keys: {keys[:5] if len(keys) > 5 else keys}")
                        for key in keys:
                            try:
                                value = obj[key]
                                result[key] = self._convert_protobuf_to_dict(value)
                            except Exception as e:
                                print(f"⚠️ Failed to get value for key '{key}': {e}")
                                result[key] = f"<error: {e}>"
                        print(f"✅ Converted MapComposite with {len(result)} keys")
                        return result
                    elif hasattr(obj, 'items'):
                        for key, value in obj.items():
                            result[key] = self._convert_protobuf_to_dict(value)
                        print(f"✅ Converted MapComposite (via items) with {len(result)} keys")
                        return result
                    
                    print(f"⚠️ MapComposite has no accessible keys or items")
                except Exception as e:
                    print(f"⚠️ MapComposite iteration failed: {e}")
            
            # For RepeatedComposite - iterate as list
            elif 'RepeatedComposite' in obj_type_str or 'Repeated' in obj_type_str:
                try:
                    if hasattr(obj, '__iter__'):
                        result = [self._convert_protobuf_to_dict(item) for item in obj]
                        print(f"✅ Converted RepeatedComposite with {len(result)} items")
                        return result
                except Exception as e:
                    print(f"⚠️ RepeatedComposite iteration failed: {e}")
        
        # Handle native dict
        if isinstance(obj, dict):
            return {key: self._convert_protobuf_to_dict(value) for key, value in obj.items()}
        
        # Handle native list/tuple
        if isinstance(obj, (list, tuple)):
            return [self._convert_protobuf_to_dict(item) for item in obj]
        
        # Handle primitive types
        if isinstance(obj, (str, int, float, bool)):
            return obj
        
        # Last resort: try to convert to dict or string
        try:
            # Try dict() conversion
            if hasattr(obj, 'keys') or hasattr(obj, 'items'):
                return dict(obj)
        except:
            pass
        
        # Fallback to string representation
        str_repr = str(obj)
        print(f"⚠️ Falling back to string representation for {type(obj)}: {str_repr[:100]}")
        return str_repr
    
    def _analyze_webhook_response(self, query_result, enable_webhook: bool) -> Dict[str, Any]:
        """
        Consolidated webhook detection and analysis logic.
        
        Args:
            query_result: The QueryResult from Dialogflow API
            enable_webhook: Whether webhooks were enabled for this request
            
        Returns:
            Dictionary containing webhook information matching WebhookInfo schema
        """
        webhook_info = {
            "called": False,
            "url": None,
            "status": "disabled" if not enable_webhook else "unknown",
            "request_payload": None,
            "response_payload": None
        }
        
        if not enable_webhook:
            webhook_info["status"] = "disabled"
            return webhook_info
        
        # Try to extract webhook URL from various sources
        webhook_url = None
        
        # Check webhook_ids (usually contains webhook identifiers, not URLs)
        if hasattr(query_result, 'webhook_ids') and query_result.webhook_ids:
            webhook_url = f"Webhook ID: {query_result.webhook_ids[0]}"
        
        # Check for webhook latencies which might give us more info
        if hasattr(query_result, 'webhook_latencies') and query_result.webhook_latencies:
            print(f"🔗 Found webhook latencies: {query_result.webhook_latencies}")
        
        # Check webhook_tags for additional context
        if hasattr(query_result, 'webhook_tags') and query_result.webhook_tags:
            print(f"🔗 Found webhook tags: {query_result.webhook_tags}")
            webhook_url = f"{webhook_url} (Tags: {', '.join(query_result.webhook_tags)})" if webhook_url else f"Tags: {', '.join(query_result.webhook_tags)}"
        
        webhook_info["url"] = webhook_url
        
        # Extract webhook payloads if available
        if hasattr(query_result, 'webhook_payloads') and query_result.webhook_payloads:
            webhook_info["called"] = True
            webhook_info["response_payload"] = []
            for i, payload in enumerate(query_result.webhook_payloads):
                try:
                    print(f"🔍 Processing webhook payload {i}: type={type(payload)}")
                    payload_dict = self._convert_protobuf_to_dict(payload)
                    
                    # Check if payload is empty
                    if not payload_dict or (isinstance(payload_dict, dict) and len(payload_dict) == 0):
                        print(f"⚠️ Webhook payload {i} is empty - webhook may not have returned data")
                        webhook_info["response_payload"].append({
                            "info": "Webhook was called but returned an empty response",
                            "note": "This is normal if the webhook doesn't need to return data"
                        })
                    else:
                        webhook_info["response_payload"].append(payload_dict)
                        print(f"✅ Successfully converted webhook payload {i} with {len(payload_dict) if isinstance(payload_dict, dict) else 'N/A'} keys")
                except Exception as e:
                    print(f"⚠️ Failed to parse webhook payload {i}: {e}")
                    webhook_info["response_payload"].append({
                        "error": str(e),
                        "type": str(type(payload))
                    })
        
        # Check for webhook_displays which might contain webhook response info
        if hasattr(query_result, 'webhook_displays') and query_result.webhook_displays:
            print(f"🔗 Found webhook_displays: {len(query_result.webhook_displays)} items")
            if not webhook_info["called"]:
                webhook_info["called"] = True
                webhook_info["response_payload"] = []
            for i, display in enumerate(query_result.webhook_displays):
                try:
                    display_dict = self._convert_protobuf_to_dict(display)
                    webhook_info["response_payload"].append({"webhook_display": display_dict})
                except:
                    pass
        
        # Reconstruct the request payload (approximate)
        if webhook_info["called"]:
            try:
                request_payload = {
                    "text": query_result.text if hasattr(query_result, 'text') else None,
                    "languageCode": query_result.language_code if hasattr(query_result, 'language_code') else None,
                }
                
                # Try to add parameters if available
                if hasattr(query_result, 'parameters') and query_result.parameters:
                    try:
                        request_payload["parameters"] = MessageToDict(query_result.parameters)
                    except:
                        request_payload["parameters"] = {}
                
                webhook_info["request_payload"] = request_payload
            except Exception as e:
                print(f"⚠️ Failed to construct request payload: {e}")
        
        # Check if webhook was called by examining webhook_statuses
        if hasattr(query_result, 'webhook_statuses') and query_result.webhook_statuses:
            print(f"🔗 Found {len(query_result.webhook_statuses)} webhook statuses")
            webhook_info["called"] = True
            
            # Analyze webhook statuses to determine success or failure
            webhook_success = True
            webhook_messages = []
            
            for i, status in enumerate(query_result.webhook_statuses):
                status_message = getattr(status, 'message', '')
                print(f"🔗 Webhook status {i}: {status_message}")
                if status_message:
                    webhook_messages.append(status_message)
                    
                    # Check for error indicators in webhook status
                    status_lower = status_message.lower()
                    if (
                        'error' in status_lower or 
                        'failed' in status_lower or 
                        'timeout' in status_lower or
                        'unreachable' in status_lower or
                        'connection refused' in status_lower or
                        'certificate' in status_lower or
                        'ssl' in status_lower or
                        any(code in status_message for code in ['400', '401', '403', '404', '500', '502', '503', '504'])
                    ):
                        webhook_success = False
                        print(f"🚨 Detected webhook error in status {i}")
            
            if webhook_success:
                webhook_info["status"] = "OK - " + "; ".join(webhook_messages) if webhook_messages else "OK"
                print(f"✅ Webhook detected as successful")
            else:
                webhook_info["status"] = "ERROR - " + "; ".join(webhook_messages)
                print(f"❌ Webhook detected as failed: {webhook_info['status']}")
        elif webhook_info["called"]:
            # Webhook payloads found but no webhook_statuses
            webhook_info["status"] = "OK"
        else:
            # Webhooks enabled but no webhook activity detected
            print(f"⚠️ Webhooks enabled but no webhook activity found")
            webhook_info["status"] = "not_configured"
        
        return webhook_info
    
    def _initialize_clients(self):
        """Initialize Dialogflow clients with user OAuth credentials."""
        try:
            # Get user's OAuth credentials
            user_token = TokenManager.get_valid_token(self.user, self.db)
            if not user_token:
                raise ValueError(
                    f"No valid Google Cloud credentials found for user {self.user.email}. "
                    "Please re-authenticate with Google Cloud."
                )
            
            credentials = TokenManager.create_credentials(
                user_token, 
                self.user.google_refresh_token
            )
            
            print(f"Initializing Dialogflow service for user {self.user.email} with project {self.project_id}")
            
            # Initialize global agents client for cross-regional agent discovery
            # All other clients (sessions, flows, pages, playbooks) are created dynamically
            # with the correct regional endpoint based on the agent's actual location
            self.global_agents_client = AgentsClient(credentials=credentials)
            
        except Exception as e:
            raise RuntimeError(
                f"Failed to initialize Dialogflow service for user {self.user.email}: {str(e)}. "
                "Please ensure you have proper Google Cloud access and re-authenticate if necessary."
            )
        
    async def list_agents(self) -> List[Dict[str, str]]:
        """List all Dialogflow CX agents accessible to the user across all locations with caching."""
        
        # Check cache first
        cache_key = (self.user.id, self.project_id)
        current_time = time.time()
        
        if cache_key in _agent_cache:
            cache_entry = _agent_cache[cache_key]
            if current_time - cache_entry["timestamp"] < _cache_ttl:
                print(f"🚀 Using cached agents for project {self.project_id} (age: {int(current_time - cache_entry['timestamp'])}s)")
                return cache_entry["agents"]
            else:
                print(f"⏰ Cache expired for project {self.project_id}, refreshing...")
                del _agent_cache[cache_key]
        
        try:
            # Try global search first (project level without location)
            try:
                agents = await self._list_agents_global()
            except Exception as global_error:
                print(f"⚠️ Global agent search failed: {str(global_error)}, falling back to parallel location-based search")
                
                # Fall back to parallel location-based search
                agents = await self._list_agents_by_locations()
            
            # Cache the results
            _agent_cache[cache_key] = {
                "agents": agents,
                "timestamp": current_time,
                "ttl": _cache_ttl
            }
            print(f"💾 Cached {len(agents)} agents for project {self.project_id}")
            
            return agents
                
        except Exception as e:
            print(f"❌ All agent search methods failed: {str(e)}")
            raise Exception(f"Failed to list agents: {str(e)}")

    async def _list_agents_global(self) -> List[Dict[str, str]]:
        """Try to list agents globally using project-level parent."""
        try:
            # Try using just the project as parent (without location)
            parent = f"projects/{self.project_id}"
            print(f"🌍 Attempting global agent search for project: {parent}")
            
            request = df.ListAgentsRequest(parent=parent)
            response = await asyncio.to_thread(self.global_agents_client.list_agents, request=request)
            
            # Prepare agent data and check permissions in parallel
            agent_list = []
            permission_tasks = []
            
            for agent in response:
                location = self._extract_location_from_agent_name(agent.name)
                agent_list.append({
                    "name": agent.name,
                    "display_name": agent.display_name,
                    "location": location
                })
                permission_tasks.append(self._test_agent_access(agent.name, location))
            
            # Execute all permission checks in parallel
            print(f"🔄 Checking permissions for {len(agent_list)} agents in parallel...")
            permission_results = await asyncio.gather(*permission_tasks, return_exceptions=True)
            
            # Combine agent data with permission results
            agents = []
            for agent_data, has_access in zip(agent_list, permission_results):
                # Handle exceptions from permission checks
                if isinstance(has_access, Exception):
                    print(f"⚠️ Permission check failed for {agent_data['display_name']}: {str(has_access)}")
                    has_access = False
                
                agent_data["accessible"] = has_access
                agents.append(agent_data)
                
                if has_access:
                    print(f"🤖 Found accessible agent: {agent_data['display_name']} in {agent_data['location']}")
                else:
                    print(f"🔒 Found inaccessible agent (no detectIntent permission): {agent_data['display_name']} in {agent_data['location']}")
            
            print(f"📊 Total agents checked in {self.project_id}: {len(agents)}")
            return agents
            
        except gcp_exceptions.GoogleAPIError as e:
            if "Invalid parent" in str(e) or "not found" in str(e).lower():
                print(f"⚠️ Global search not supported, error: {str(e)}")
                raise Exception("Global search not supported")
            else:
                raise e

    def _extract_location_from_agent_name(self, agent_name: str) -> str:
        """Extract location from agent's full name."""
        # Format: projects/{project}/locations/{location}/agents/{agent-id}
        parts = agent_name.split('/')
        if len(parts) >= 4 and parts[0] == 'projects' and parts[2] == 'locations':
            return parts[3]
        return 'unknown'

    async def _test_agent_access(self, agent_name: str, location: str) -> bool:
        """
        Test if user has dialogflow.sessions.detectIntent permission on this agent.
        Uses caching to avoid repeated API calls for the same agent.
        Returns True if accessible, False otherwise.
        """
        # Check permission cache first
        cache_key = (self.user.id, agent_name)
        now = time.time()
        
        if cache_key in _permission_cache:
            cached = _permission_cache[cache_key]
            if now - cached["timestamp"] < _permission_cache_ttl:
                return cached["accessible"]
        
        try:
            # Get user credentials
            user_token = TokenManager.get_valid_token(self.user, self.db)
            if not user_token:
                # Cache negative result
                _permission_cache[cache_key] = {"accessible": False, "timestamp": now, "ttl": _permission_cache_ttl}
                return False
            
            credentials = TokenManager.create_credentials(
                user_token,
                self.user.google_refresh_token
            )
            
            # Create sessions client for this location
            if location == 'global':
                client_options = None
            else:
                client_options = ClientOptions(api_endpoint=f"{location}-dialogflow.googleapis.com")
            
            sessions_client = SessionsClient(credentials=credentials, client_options=client_options)
            
            # Test detectIntent permission directly with a minimal test message
            # This is the ACTUAL permission needed, not agents.get
            session = f"{agent_name}/sessions/permission-check-{int(now)}"
            
            # Create a minimal detect intent request to test permissions
            query_input = df.QueryInput(
                text=df.TextInput(text="test"),
                language_code="en"
            )
            
            request = df.DetectIntentRequest(
                session=session,
                query_input=query_input
            )
            
            # Try to call detectIntent - this is the real permission test
            await asyncio.to_thread(sessions_client.detect_intent, request=request)
            
            # Cache positive result
            _permission_cache[cache_key] = {"accessible": True, "timestamp": now, "ttl": _permission_cache_ttl}
            return True
            
        except gcp_exceptions.PermissionDenied:
            # User doesn't have permission to access this agent
            # Cache negative result
            _permission_cache[cache_key] = {"accessible": False, "timestamp": now, "ttl": _permission_cache_ttl}
            return False
        except Exception as e:
            error_str = str(e).lower()
            
            # Handle gRPC metadata size errors - these occur when agents with datastores
            # return large responses (grounding citations, etc.). The agent IS accessible,
            # the response is just too large for gRPC's default metadata limit.
            if "metadata size exceeds" in error_str or "received metadata size" in error_str:
                print(f"✅ Agent accessible but has large metadata (datastore response): {agent_name}")
                _permission_cache[cache_key] = {"accessible": True, "timestamp": now, "ttl": _permission_cache_ttl}
                return True
            
            # Handle rate limiting errors - these indicate the agent IS accessible,
            # just that we're being rate limited. Assume accessible.
            if "429" in str(e) and "quota" in error_str:
                print(f"⚠️ Rate limited checking agent access (assuming accessible): {agent_name}")
                _permission_cache[cache_key] = {"accessible": True, "timestamp": now, "ttl": _permission_cache_ttl}
                return True
            
            # Other errors (network, etc.) - log but assume inaccessible to be safe
            print(f"⚠️ Error testing agent access for {agent_name}: {str(e)}")
            # Cache negative result for transient errors too
            _permission_cache[cache_key] = {"accessible": False, "timestamp": now, "ttl": _permission_cache_ttl}
            return False

    async def _get_regional_flows_client(self, location: str):
        """Get a FlowsClient configured for the specified location."""
        try:
            # Get user credentials using the correct TokenManager method
            user_token = TokenManager.get_valid_token(self.user, self.db)
            if not user_token:
                raise ValueError(f"No valid Google Cloud credentials found for user {self.user.email}")
            
            credentials = TokenManager.create_credentials(
                user_token, 
                self.user.google_refresh_token
            )
            
            # Create regional client options
            if location == 'global':
                # For global location, use the default endpoint
                client_options = None
            else:
                # For regional locations, use regional endpoint
                client_options = ClientOptions(api_endpoint=f"{location}-dialogflow.googleapis.com")
            
            # Create and return regional flows client
            return FlowsClient(credentials=credentials, client_options=client_options)
            
        except Exception as e:
            print(f"❌ Error creating regional flows client for {location}: {str(e)}")
            # Fallback to default flows client
            return self.flows_client

    async def _get_regional_pages_client(self, location: str):
        """Get a PagesClient configured for the specified location."""
        try:
            # Get user credentials using the correct TokenManager method
            user_token = TokenManager.get_valid_token(self.user, self.db)
            if not user_token:
                raise ValueError(f"No valid Google Cloud credentials found for user {self.user.email}")
            
            credentials = TokenManager.create_credentials(
                user_token, 
                self.user.google_refresh_token
            )
            
            # Create regional client options
            if location == 'global':
                # For global location, use the default endpoint
                client_options = None
            else:
                # For regional locations, use regional endpoint
                client_options = ClientOptions(api_endpoint=f"{location}-dialogflow.googleapis.com")
            
            # Create and return regional pages client
            return PagesClient(credentials=credentials, client_options=client_options)
            
        except Exception as e:
            print(f"❌ Error creating regional pages client for {location}: {str(e)}")
            # Fallback to default pages client
            return self.pages_client

    def _extract_location_from_flow_name(self, flow_name: str) -> str:
        """Extract location from flow's full name."""
        # Format: projects/{project}/locations/{location}/agents/{agent-id}/flows/{flow-id}
        parts = flow_name.split('/')
        if len(parts) >= 4 and parts[0] == 'projects' and parts[2] == 'locations':
            return parts[3]
        return 'unknown'

    async def _get_regional_sessions_client(self, location: str):
        """Get a SessionsClient configured for the specified location with large metadata support."""
        try:
            from google.cloud.dialogflowcx_v3beta1.services.sessions.transports import SessionsGrpcTransport
            import grpc
            from google.auth.transport import grpc as google_auth_grpc
            from google.auth.transport.requests import Request
            
            # Get user credentials using the correct TokenManager method
            user_token = TokenManager.get_valid_token(self.user, self.db)
            if not user_token:
                raise ValueError(f"No valid Google Cloud credentials found for user {self.user.email}")
            
            credentials = TokenManager.create_credentials(
                user_token, 
                self.user.google_refresh_token
            )
            
            # gRPC channel options to handle large metadata from agents with datastores
            # Agents with playbooks connected to datastores can return large grounding metadata
            # (citations, sources, etc.) that can exceed the default 16KB limit
            # We increase to 128KB to handle this metadata
            grpc_options = [
                ("grpc.max_metadata_size", 128 * 1024),  # 128KB for metadata
                ("grpc.max_receive_message_length", 50 * 1024 * 1024),  # 50MB for messages
            ]
            
            # Determine the endpoint based on location
            if location == 'global':
                api_endpoint = "dialogflow.googleapis.com"
            else:
                api_endpoint = f"{location}-dialogflow.googleapis.com"
            
            try:
                # Create an authenticated gRPC channel with custom options for large metadata
                grpc_channel = google_auth_grpc.secure_authorized_channel(
                    credentials,
                    Request(),
                    f"{api_endpoint}:443",
                    options=grpc_options
                )
                
                # Create a custom transport with the authenticated channel
                transport = SessionsGrpcTransport(
                    host=api_endpoint,
                    credentials=credentials,
                    channel=grpc_channel
                )
                
                # Create and return regional sessions client with the custom transport
                return SessionsClient(transport=transport)
            except Exception as transport_error:
                # If transport creation fails, fall back to standard client
                print(f"⚠️ Custom transport failed for {location}, using standard client: {str(transport_error)}")
                client_options = ClientOptions(api_endpoint=api_endpoint) if location != 'global' else None
                return SessionsClient(credentials=credentials, client_options=client_options)
            
        except Exception as e:
            print(f"❌ Error creating regional sessions client for {location}: {str(e)}")
            # Fallback to default sessions client
            return self.sessions_client
            
        except Exception as e:
            print(f"❌ Error creating regional sessions client for {location}: {str(e)}")
            # Fallback to default sessions client
            return self.sessions_client

    async def _get_regional_playbooks_client(self, location: str):
        """Get a PlaybooksClient configured for the specified location."""
        try:
            # Get user credentials using the correct TokenManager method
            user_token = TokenManager.get_valid_token(self.user, self.db)
            if not user_token:
                raise ValueError(f"No valid Google Cloud credentials found for user {self.user.email}")
            
            credentials = TokenManager.create_credentials(
                user_token, 
                self.user.google_refresh_token
            )
            
            # Create regional client options
            if location == 'global':
                # For global location, use the default endpoint
                client_options = None
            else:
                # For regional locations, use regional endpoint
                client_options = ClientOptions(api_endpoint=f"{location}-dialogflow.googleapis.com")
            
            # Create and return regional playbooks client
            return PlaybooksClient(credentials=credentials, client_options=client_options)
            
        except Exception as e:
            print(f"❌ Error creating regional playbooks client for {location}: {str(e)}")
            # Fallback to default playbooks client
            return self.playbooks_client

    async def _find_agent_full_name(self, agent_id: str) -> str:
        """Find the full agent name (with location) by searching across all locations with optimization."""
        try:
            # First try to use cached agents if available
            cache_key = (self.user.id, self.project_id)
            current_time = time.time()
            
            if cache_key in _agent_cache:
                cache_entry = _agent_cache[cache_key]
                if current_time - cache_entry["timestamp"] < _cache_ttl:
                    # Search in cached agents first
                    for agent in cache_entry["agents"]:
                        agent_parts = agent["name"].split('/')
                        if len(agent_parts) >= 6 and agent_parts[-1] == agent_id:
                            print(f"✅ Found agent {agent_id} in cache: {agent['name']}")
                            return agent["name"]
            
            print(f"🔍 Agent {agent_id} not in cache, searching across regions...")
            
            # Use parallel search for better performance
            common_locations = ['global', 'us-central1', 'us-east1', 'us-west1', 'europe-west1', 'asia-northeast1']
            
            # Create credentials once for reuse
            user_token = TokenManager.get_valid_token(self.user, self.db)
            if not user_token:
                raise ValueError(f"No valid Google Cloud credentials found for user {self.user.email}")
            
            credentials = TokenManager.create_credentials(user_token, self.user.google_refresh_token)
            
            # Create search tasks for parallel execution
            search_tasks = []
            for location in common_locations:
                task = self._find_agent_in_location(agent_id, location, credentials)
                search_tasks.append(task)
            
            # Execute searches in parallel
            search_results = await asyncio.gather(*search_tasks, return_exceptions=True)
            
            # Check results for the agent
            for result in search_results:
                if isinstance(result, str) and result:  # Found agent name
                    return result
            
            print(f"❌ Agent {agent_id} not found in any location")
            return None
            
        except Exception as e:
            print(f"❌ Error in _find_agent_full_name: {str(e)}")
            return None

    async def _find_agent_in_location(self, agent_id: str, location: str, credentials) -> Optional[str]:
        """Search for a specific agent in a given location."""
        try:
            parent = f"projects/{self.project_id}/locations/{location}"
            request = df.ListAgentsRequest(parent=parent)
            
            if location == 'global':
                client_options = None
            else:
                client_options = ClientOptions(api_endpoint=f"{location}-dialogflow.googleapis.com")
            
            regional_client = AgentsClient(credentials=credentials, client_options=client_options)
            response = await asyncio.to_thread(regional_client.list_agents, request=request)
            
            # Check if our agent is in this location
            for agent in response:
                # Extract agent ID from full name
                agent_parts = agent.name.split('/')
                if len(agent_parts) >= 6 and agent_parts[-1] == agent_id:
                    print(f"✅ Found agent {agent_id} in location {location}: {agent.name}")
                    return agent.name
            
            return None
            
        except Exception as e:
            print(f"⚠️ Error searching for agent {agent_id} in location {location}: {str(e)}")
            return None

    async def _list_agents_by_locations(self) -> List[Dict[str, str]]:
        """Optimized method to search agents by searching locations in parallel."""
        print(f"🔍 Using parallel location-based search")
        
        # Use common Dialogflow locations including global
        common_locations = ['global', 'us-central1', 'us-east1', 'us-west1', 'europe-west1', 'asia-northeast1']
        
        # Create credentials once for reuse
        credentials = TokenManager.create_credentials(
            TokenManager.get_valid_token(self.user, self.db), 
            self.user.google_refresh_token
        )
        
        # Create all search tasks concurrently
        search_tasks = []
        for location in common_locations:
            task = self._search_agents_in_location(location, credentials)
            search_tasks.append(task)
        
        # Execute all searches in parallel
        print(f"🚀 Searching {len(common_locations)} locations in parallel")
        search_results = await asyncio.gather(*search_tasks, return_exceptions=True)
        
        # Aggregate results from all locations
        all_agents = []
        total_locations_searched = 0
        successful_locations = 0
        
        for i, result in enumerate(search_results):
            location = common_locations[i]
            total_locations_searched += 1
            
            if isinstance(result, Exception):
                print(f"⚠️ Error searching location {location}: {str(result)}")
                continue
            
            successful_locations += 1
            location_agents = result
            all_agents.extend(location_agents)
            
            if location_agents:
                print(f"📊 Agents found in {location}: {len(location_agents)}")
        
        print(f"📊 Searched {total_locations_searched} locations ({successful_locations} successful)")
        print(f"📊 Total agents found across all locations in {self.project_id}: {len(all_agents)}")
        return all_agents

    async def _search_agents_in_location(self, location: str, credentials) -> List[Dict[str, str]]:
        """Search for agents in a specific location."""
        try:
            parent = f"projects/{self.project_id}/locations/{location}"
            print(f"🔍 Searching location: {parent}")
            request = df.ListAgentsRequest(parent=parent)
            
            # Create a regional client for this specific location
            if location == 'global':
                client_options = None
            else:
                client_options = ClientOptions(api_endpoint=f"{location}-dialogflow.googleapis.com")
            regional_client = AgentsClient(credentials=credentials, client_options=client_options)
            
            response = await asyncio.to_thread(regional_client.list_agents, request=request)
            
            # Prepare agent data and check permissions in parallel
            agent_list = []
            permission_tasks = []
            
            for agent in response:
                agent_list.append({
                    "name": agent.name,
                    "display_name": agent.display_name,
                    "location": location
                })
                permission_tasks.append(self._test_agent_access(agent.name, location))
            
            # Execute all permission checks in parallel for this location
            if permission_tasks:
                print(f"🔄 Checking permissions for {len(agent_list)} agents in {location} in parallel...")
                permission_results = await asyncio.gather(*permission_tasks, return_exceptions=True)
                
                # Combine agent data with permission results
                location_agents = []
                for agent_data, has_access in zip(agent_list, permission_results):
                    # Handle exceptions from permission checks
                    if isinstance(has_access, Exception):
                        print(f"⚠️ Permission check failed for {agent_data['display_name']}: {str(has_access)}")
                        has_access = False
                    
                    agent_data["accessible"] = has_access
                    location_agents.append(agent_data)
                    
                    if has_access:
                        print(f"🤖 Found accessible agent in {location}: {agent_data['display_name']}")
                    else:
                        print(f"🔒 Found inaccessible agent (no detectIntent permission) in {location}: {agent_data['display_name']}")
            else:
                location_agents = []
            
            return location_agents
            
        except gcp_exceptions.GoogleAPIError as e:
            print(f"⚠️ Could not search location {location}: {str(e)}")
            return []
        except Exception as e:
            print(f"⚠️ Error searching location {location}: {str(e)}")
            return []

    @staticmethod
    def clear_agent_cache(user_id: Optional[int] = None, project_id: Optional[str] = None):
        """Clear agent cache for specific user/project or all entries."""
        global _agent_cache
        
        if user_id and project_id:
            cache_key = (user_id, project_id)
            if cache_key in _agent_cache:
                del _agent_cache[cache_key]
                print(f"🗑️ Cleared agent cache for user {user_id}, project {project_id}")
        else:
            _agent_cache.clear()
            print(f"🗑️ Cleared all agent cache entries")
    
    @staticmethod
    def clear_permission_cache(user_id: Optional[int] = None):
        """Clear agent permission cache for specific user or all entries."""
        global _permission_cache
        
        if user_id:
            # Clear all permission entries for this user
            keys_to_delete = [key for key in _permission_cache.keys() if key[0] == user_id]
            for key in keys_to_delete:
                del _permission_cache[key]
            print(f"🗑️ Cleared {len(keys_to_delete)} permission cache entries for user {user_id}")
        else:
            _permission_cache.clear()
            print(f"🗑️ Cleared all permission cache entries")

    async def list_projects(self) -> List[Dict[str, str]]:
        """List all Google Cloud projects accessible to the user."""
        try:
            # Import Google Cloud Resource Manager
            from google.cloud import resourcemanager_v3
            
            # Use user credentials
            user_token = TokenManager.get_valid_token(self.user, self.db)
            if not user_token:
                raise ValueError("No valid user credentials found")
                
            credentials = TokenManager.create_credentials(
                user_token, 
                self.user.google_refresh_token
            )
            
            # Initialize the client
            client = resourcemanager_v3.ProjectsClient(credentials=credentials)
            
            # Use search_projects to get all projects accessible to the user
            request = resourcemanager_v3.SearchProjectsRequest()
            
            response = await asyncio.to_thread(client.search_projects, request=request)
            projects = []
            
            for project in response:
                if project.state == resourcemanager_v3.Project.State.ACTIVE:
                    projects.append({
                        "project_id": project.project_id,
                        "name": project.display_name or project.project_id,
                        "display_name": project.display_name or project.project_id
                    })
            
            return projects
        except Exception as e:
            raise Exception(f"Failed to list Google Cloud projects: {str(e)}")

    async def list_flows(self, agent_name: str) -> List[Dict[str, str]]:
        """List all flows for a given agent."""
        try:
            # Extract location from agent name to use correct regional client
            location = self._extract_location_from_agent_name(agent_name)
            print(f"🔄 Listing flows for agent in location: {location}")
            
            # Get the appropriate flows client for this location
            flows_client = await self._get_regional_flows_client(location)
            
            request = df.ListFlowsRequest(parent=agent_name)
            response = await asyncio.to_thread(flows_client.list_flows, request=request)
            
            flows = []
            for flow in response:
                flows.append({
                    "name": flow.name,
                    "display_name": flow.display_name
                })
            
            print(f"✅ Found {len(flows)} flows for agent in {location}")
            return flows
        except gcp_exceptions.GoogleAPIError as e:
            raise Exception(f"Failed to list flows: {str(e)}")
        except Exception as e:
            raise Exception(f"Unexpected error listing flows: {str(e)}")

    async def list_pages(self, flow_name: str) -> List[Dict[str, str]]:
        """List all pages for a given flow."""
        try:
            # Extract location from flow name to use correct regional client
            location = self._extract_location_from_flow_name(flow_name)
            print(f"🔄 Listing pages for flow in location: {location}")
            
            # Get the appropriate pages client for this location
            pages_client = await self._get_regional_pages_client(location)
            
            request = df.ListPagesRequest(parent=flow_name)
            response = await asyncio.to_thread(pages_client.list_pages, request=request)
            
            pages = []
            for page in response:
                pages.append({
                    "name": page.name,
                    "display_name": page.display_name
                })
            
            print(f"✅ Found {len(pages)} pages for flow in {location}")
            return pages
        except gcp_exceptions.GoogleAPIError as e:
            raise Exception(f"Failed to list pages: {str(e)}")
        except Exception as e:
            raise Exception(f"Unexpected error listing pages: {str(e)}")

    async def list_playbooks(self, agent_name: str) -> List[Dict[str, str]]:
        """List all playbooks for a given agent."""
        try:
            # Extract location from agent name to use correct regional client
            location = self._extract_location_from_agent_name(agent_name)
            print(f"🔄 Listing playbooks for agent in location: {location}")
            
            # Get the appropriate playbooks client for this location
            playbooks_client = await self._get_regional_playbooks_client(location)
            
            request = df.ListPlaybooksRequest(parent=agent_name)
            response = await asyncio.to_thread(playbooks_client.list_playbooks, request=request)
            
            playbooks = []
            for playbook in response:
                playbooks.append({
                    "name": playbook.name,
                    "display_name": playbook.display_name
                })
            
            print(f"✅ Found {len(playbooks)} playbooks for agent in {location}")
            return playbooks
        except gcp_exceptions.GoogleAPIError as e:
            raise Exception(f"Failed to list playbooks: {str(e)}")
        except Exception as e:
            raise Exception(f"Unexpected error listing playbooks: {str(e)}")

    async def list_start_resources(self, agent_name: str) -> Dict[str, List[Dict[str, str]]]:
        """List both flows and playbooks for a given agent as 'start resources'."""
        try:
            # Get flows and playbooks concurrently
            flows_task = self.list_flows(agent_name)
            playbooks_task = self.list_playbooks(agent_name)
            
            flows, playbooks = await asyncio.gather(flows_task, playbooks_task, return_exceptions=True)
            
            # Handle any errors gracefully
            if isinstance(flows, Exception):
                print(f"⚠️ Error listing flows: {str(flows)}")
                flows = []
            if isinstance(playbooks, Exception):
                print(f"⚠️ Error listing playbooks: {str(playbooks)}")
                playbooks = []
            
            # Add type indicator and id field to each resource
            def add_id_and_type(resource, resource_type):
                # Extract ID from the resource name (last part after the last '/')
                resource_id = resource["name"].split('/')[-1] if resource["name"] else ""
                return {
                    "id": resource_id,
                    "type": resource_type,
                    **resource
                }
            
            flows_with_type = [add_id_and_type(flow, "flow") for flow in flows]
            playbooks_with_type = [add_id_and_type(playbook, "playbook") for playbook in playbooks]
            
            return {
                "flows": flows_with_type,
                "playbooks": playbooks_with_type,
                "all": flows_with_type + playbooks_with_type
            }
        except Exception as e:
            raise Exception(f"Unexpected error listing start resources: {str(e)}")

    async def detect_intent(
        self,
        agent_name: str,
        session_id: str,
        text_input: str,
        language_code: str = "en",
        session_parameters: Optional[Dict[str, str]] = None,
        playbook_id: Optional[str] = None,
        enable_webhook: bool = True
    ) -> Dict[str, Any]:
        """
        Detect intent from user input text.
        
        Args:
            agent_name: Full agent resource name
            session_id: Unique session identifier
            text_input: User input text
            language_code: Language code (default: en)
            session_parameters: Optional key-value pairs to pass as session parameters
            
        Returns:
            Dictionary containing intent detection results
        """
        try:
            # Extract location from agent name to use correct regional client
            location = self._extract_location_from_agent_name(agent_name)
            print(f"🔄 Detecting intent for agent in location: {location}")
            print(f"🔧 detect_intent called with enable_webhook={enable_webhook}")
            
            # Get the appropriate sessions client for this location
            sessions_client = await self._get_regional_sessions_client(location)
            
            session_path = f"{agent_name}/sessions/{session_id}"
            
            text_input_obj = df.TextInput(text=text_input)
            query_input = df.QueryInput(
                text=text_input_obj,
                language_code=language_code
            )
            
            # Add query parameters with session parameters and playbook support
            query_params_dict = {}
            if session_parameters:
                query_params_dict.update(session_parameters)
            
            # Always create query_params to set webhook configuration
            query_params = df.QueryParameters(parameters=query_params_dict)
            
            # Set webhook configuration (default to enabled, disable if requested)
            query_params.disable_webhook = not enable_webhook
            if not enable_webhook:
                print(f"🚫 Webhooks disabled for this request")
                
            # Add playbook support if playbook_id is provided
            if playbook_id:
                playbook_resource_name = f"{agent_name}/playbooks/{playbook_id}"
                query_params.current_playbook = playbook_resource_name
                print(f"🎭 Using playbook: {playbook_id}")
                print(f"🎭 Full playbook resource name: {playbook_resource_name}")
            
            request = df.DetectIntentRequest(
                session=session_path,
                query_input=query_input,
                query_params=query_params
            )
            
            start_time = time.time()
            response = await asyncio.to_thread(sessions_client.detect_intent, request=request)
            execution_time = int((time.time() - start_time) * 1000)  # milliseconds
            
            # Extract response information
            result = {
                "query_text": text_input,
                "response_text": "",
                "response_messages": [],  # List of individual response messages
                "intent": {
                    "name": "",
                    "display_name": ""
                },
                "intent_detection_confidence": 0.0,
                "fulfillment_text": "",
                "parameters": {},
                "session_id": session_id,
                "response_time_ms": execution_time,
                "language_code": language_code,
                "is_mock": False,
                "webhook_info": {
                    "webhook_called": False,
                    "webhook_status": "disabled" if not enable_webhook else "unknown",
                    "webhook_error": None,
                    "webhook_message": None
                }
            }
            
            if response.query_result:
                query_result = response.query_result
                
                # Get response text from fulfillment messages
                response_texts = []
                for message in query_result.response_messages:
                    if message.text:
                        response_texts.extend(message.text.text)
                
                # Extract parameters safely with comprehensive error handling
                safe_parameters = {}
                try:
                    if query_result.parameters:
                        print(f"🔍 Processing {len(query_result.parameters)} parameters...")
                        for key, value in query_result.parameters.items():
                            try:
                                print(f"🔍 Processing parameter '{key}' with type {type(value)}")
                                # Handle Google Cloud Value objects safely
                                if hasattr(value, 'kind'):
                                    print(f"🔍 Parameter '{key}' has kind attribute: {value.kind}")
                                    if value.kind is not None:
                                        # Handle different Value types based on kind
                                        if hasattr(value, 'string_value') and value.string_value:
                                            safe_parameters[key] = value.string_value
                                        elif hasattr(value, 'number_value') and value.number_value is not None:
                                            safe_parameters[key] = str(value.number_value)
                                        elif hasattr(value, 'bool_value') and value.bool_value is not None:
                                            safe_parameters[key] = str(value.bool_value)
                                        elif hasattr(value, 'list_value') and value.list_value:
                                            safe_parameters[key] = str(value.list_value)
                                        elif hasattr(value, 'struct_value') and value.struct_value:
                                            safe_parameters[key] = str(value.struct_value)
                                        else:
                                            # For other kind types, try to get string representation
                                            safe_parameters[key] = str(value)
                                    else:
                                        # Handle case where kind is None - this was causing our error
                                        print(f"⚠️ Parameter {key} has None kind, using fallback")
                                        safe_parameters[key] = str(value) if value is not None else ""
                                else:
                                    print(f"🔍 Parameter '{key}' does not have kind attribute")
                                    # Fallback for simple values without kind attribute
                                    safe_parameters[key] = str(value) if value is not None else ""
                                print(f"✅ Successfully processed parameter '{key}': {safe_parameters[key]}")
                            except Exception as param_error:
                                # If parameter extraction fails, log and skip
                                print(f"⚠️ Failed to extract parameter {key}: {str(param_error)}")
                                safe_parameters[key] = f"[Error extracting parameter: {str(param_error)}]"
                except Exception as params_error:
                    # If entire parameter extraction fails, log and continue with empty params
                    print(f"⚠️ Failed to extract parameters entirely: {str(params_error)}")
                    safe_parameters = {}

                # Detect webhook status using consolidated logic
                webhook_info = self._analyze_webhook_response(query_result, enable_webhook)
                
                result.update({
                    "response_text": " ".join(response_texts),  # Keep for backward compatibility
                    "response_messages": response_texts,  # Return as list for proper display
                    "fulfillment_text": " ".join(response_texts),
                    "intent": {
                        "name": query_result.intent.name if query_result.intent else "",
                        "display_name": query_result.intent.display_name if query_result.intent else ""
                    },
                    "intent_detection_confidence": query_result.intent_detection_confidence,
                    "parameters": safe_parameters,
                    "webhook_info": webhook_info
                })
            
            return result
            
        except gcp_exceptions.GoogleAPIError as e:
            # Enhanced error handling for Google API errors
            error_details = str(e)
            error_code = getattr(e, 'code', None)
            
            # Check for webhook-specific errors - these should be treated as warnings, not fatal errors
            if "webhook" in error_details.lower() or "fulfillment" in error_details.lower():
                print(f"⚠️ Webhook error detected (non-fatal): {error_details}")
                
                # Create a response that includes the webhook error details
                error_status = "ERROR - "
                if "timeout" in error_details.lower():
                    error_status += "Webhook timeout - endpoint took too long to respond"
                elif "unavailable" in error_details.lower() or "connection" in error_details.lower():
                    error_status += "Webhook connection error - unable to reach endpoint"
                elif "authentication" in error_details.lower() or "unauthorized" in error_details.lower():
                    error_status += "Webhook authentication error - endpoint rejected request"
                elif "ssl" in error_details.lower() or "certificate" in error_details.lower():
                    error_status += "Webhook SSL/Certificate error"
                else:
                    error_status += "Webhook error - check webhook configuration"
                
                webhook_error_info = {
                    "called": True,
                    "url": None,
                    "status": error_status,
                    "request_payload": None,
                    "response_payload": None
                }
                
                # Return a result with webhook error info instead of throwing
                return {
                    "query_text": text_input,
                    "response_text": "Agent response unavailable due to webhook error",
                    "intent": {
                        "name": "",
                        "display_name": "Unknown (webhook error)"
                    },
                    "intent_detection_confidence": 0.0,
                    "fulfillment_text": "Agent response unavailable due to webhook error",
                    "parameters": {},
                    "session_id": session_id,
                    "response_time_ms": 0,
                    "language_code": language_code,
                    "is_mock": False,
                    "webhook_info": webhook_error_info
                }
            
            # For non-webhook errors, continue with the original error handling
            elif "agent" in error_details.lower() and ("not found" in error_details.lower() or "does not exist" in error_details.lower()):
                raise Exception(f"Agent not found: The specified Dialogflow agent could not be found. Please verify the agent ID and ensure you have access to it. Details: {error_details}")
            elif "permission" in error_details.lower() or "access" in error_details.lower():
                raise Exception(f"Permission error: You don't have sufficient permissions to access this Dialogflow agent. Please check your IAM roles and permissions. Details: {error_details}")
            elif "quota" in error_details.lower() or "limit" in error_details.lower():
                raise Exception(f"Quota/Rate limit error: You've exceeded the API quota or rate limits. Please wait and try again, or check your quota settings. Details: {error_details}")
            elif "session" in error_details.lower() and "invalid" in error_details.lower():
                raise Exception(f"Invalid session error: The session ID is invalid or malformed. Please check the session ID format. Details: {error_details}")
            else:
                raise Exception(f"Dialogflow API error: {error_details}")
        except Exception as e:
            # Enhanced general error handling
            error_msg = str(e)
            
            # Check if it's already a formatted error from above
            if any(prefix in error_msg for prefix in ["Webhook", "Agent not found", "Permission error", "Quota/Rate limit", "Invalid session", "Dialogflow API error"]):
                raise e  # Re-raise the already formatted error
            
            # Handle other potential issues
            if "timeout" in error_msg.lower():
                raise Exception(f"Request timeout: The request to Dialogflow took too long. This might be due to network issues or heavy load. Please try again. Details: {error_msg}")
            elif "network" in error_msg.lower() or "connection" in error_msg.lower():
                raise Exception(f"Network error: Unable to connect to Dialogflow. Please check your internet connection and try again. Details: {error_msg}")
            else:
                raise Exception(f"Unexpected error during intent detection: {error_msg}")

    async def test_multiple_intents(
        self,
        agent_name: str,
        test_cases: List[Dict[str, Any]],
        session_prefix: str = "test_session",
        session_parameters: Optional[Dict[str, str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Test multiple intents against a Dialogflow agent.
        
        Args:
            agent_name: Full agent resource name
            test_cases: List of test cases with input text and expected results
            session_prefix: Prefix for session IDs
            
        Returns:
            List of test results
        """
        results = []
        
        for i, test_case in enumerate(test_cases):
            session_id = f"{session_prefix}_{i}_{int(time.time())}"
            
            try:
                # Get the intent detection result
                result = await self.detect_intent(
                    agent_name=agent_name,
                    session_id=session_id,
                    text_input=test_case.get("input_text", ""),
                    language_code=test_case.get("language_code", "en"),
                    session_parameters=session_parameters
                )
                
                # Build test result with comparison
                test_result = {
                    "test_case_id": test_case.get("id"),
                    "input_text": test_case.get("input_text"),
                    "expected_answer": test_case.get("expected_answer", ""),
                    "actual_response": result["fulfillment_text"],
                    "expected_intent": test_case.get("expected_intent"),
                    "actual_intent": result["intent"]["display_name"],
                    "confidence": result["intent_detection_confidence"],
                    "parameters": result["parameters"],
                    "response_time_ms": result["response_time_ms"],
                    "session_id": session_id,
                    "language_code": result["language_code"],
                    "is_mock": result.get("is_mock", False),
                    "passed": self._evaluate_test_result(test_case, result),
                    "error": None,
                    "metadata": test_case.get("metadata", {})
                }
                
                results.append(test_result)
                
            except Exception as e:
                # Handle any errors during intent detection
                test_result = {
                    "test_case_id": test_case.get("id"),
                    "input_text": test_case.get("input_text"),
                    "expected_answer": test_case.get("expected_answer", ""),
                    "actual_response": None,
                    "expected_intent": test_case.get("expected_intent"),
                    "actual_intent": None,
                    "confidence": 0.0,
                    "parameters": {},
                    "response_time_ms": 0,
                    "session_id": session_id,
                    "language_code": test_case.get("language_code", "en"),
                    "is_mock": False,
                    "passed": False,
                    "error": str(e),
                    "metadata": test_case.get("metadata", {})
                }
                
                results.append(test_result)
                
        return results

    def _evaluate_test_result(self, test_case: Dict[str, Any], result: Dict[str, Any]) -> bool:
        """
        Simple evaluation of test result (basic intent matching).
        For more sophisticated evaluation, use the LLM service.
        """
        expected_intent = test_case.get("expected_intent", "").lower()
        actual_intent = result["intent"]["display_name"].lower()
        
        # Simple string matching for now
        if expected_intent and actual_intent:
            return expected_intent in actual_intent or actual_intent in expected_intent
        
        # If no expected intent specified, consider it passed if we got any response
        return bool(result.get("fulfillment_text"))

    async def batch_test_intents(
        self,
        agent_name: str,
        test_cases: List[Dict[str, Any]],
        batch_size: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Test intents in batches for better performance.
        
        Args:
            agent_name: Full agent resource name
            test_cases: List of test cases
            batch_size: Number of tests to run concurrently
            
        Returns:
            List of all test results
        """
        all_results = []
        
        # Process test cases in batches
        for i in range(0, len(test_cases), batch_size):
            batch = test_cases[i:i + batch_size]
            
            # Run batch concurrently
            batch_results = await self.test_multiple_intents(
                agent_name=agent_name,
                test_cases=batch,
                session_prefix=f"batch_{i // batch_size}"
            )
            
            all_results.extend(batch_results)
            
            # Small delay between batches to avoid rate limiting
            if i + batch_size < len(test_cases):
                await asyncio.sleep(0.1)
                
        return all_results

    async def batch_detect_intent(
        self,
        agent_name: str,
        questions: List[str],
        session_id_prefix: str = "test",
        language_code: str = "en",
        batch_size: int = 10,
        session_parameters: Optional[Dict[str, str]] = None,
        playbook_id: Optional[str] = None,
        enable_webhook: bool = True
    ) -> List[Dict[str, Any]]:
        """Process multiple questions in batches to avoid rate limits."""
        results = []
        
        for i in range(0, len(questions), batch_size):
            batch = questions[i:i + batch_size]
            batch_tasks = []
            
            for j, question in enumerate(batch):
                session_id = f"{session_id_prefix}_{i + j}_{int(time.time())}"
                task = self.detect_intent(agent_name, session_id, question, language_code, session_parameters, playbook_id, enable_webhook)
                batch_tasks.append(task)
            
            # Process batch concurrently
            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
            
            for result in batch_results:
                if isinstance(result, Exception):
                    results.append({
                        "error": str(result),
                        "response_time_ms": 0,
                        "is_mock": False
                    })
                else:
                    results.append(result)
            
            # Small delay between batches to be respectful of rate limits
            if i + batch_size < len(questions):
                await asyncio.sleep(0.1)
        
        return results

    async def quick_test(
        self,
        agent_id: str,
        prompt: str,
        flow_id: Optional[str] = None,
        page_id: Optional[str] = None,
        playbook_id: Optional[str] = None,
        model_id: Optional[str] = None,
        session_id: Optional[str] = None,
        language_code: str = "en",
        session_parameters: Optional[Dict[str, str]] = None,
        enable_webhook: bool = True,
        pre_prompt_messages: Optional[List[str]] = None,
        post_prompt_messages: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Quick test a single prompt against a Dialogflow agent.
        
        Args:
            agent_id: The agent ID (e.g., f4f0de0a-c228-4622-b218-c84493ab7b4a)
            prompt: The text prompt to test
            flow_id: Optional flow ID to start from
            page_id: Optional page ID to start from  
            playbook_id: Optional playbook ID to use for conversation
            model_id: Optional model ID when using playbooks (e.g., gemini-1.5-pro)
            session_id: Optional session ID, will generate if not provided
            language_code: Language code (default: "en")
            session_parameters: Optional key-value pairs to pass as session parameters
            enable_webhook: Whether to enable webhooks
            pre_prompt_messages: Optional messages to send before the main prompt
            post_prompt_messages: Optional messages to send after the main prompt
            
        Returns:
            Dict with response details including text, intent, confidence, etc.
        """
        if not session_id:
            session_id = f"quick_test_{int(time.time())}"
            
        # Find the agent's full name with correct location
        agent_name = await self._find_agent_full_name(agent_id)
        if not agent_name:
            raise Exception(f"Agent with ID {agent_id} not found in any location")
        
        # Check if we should use message sequence (when pre/post messages are provided)
        if (pre_prompt_messages and len(pre_prompt_messages) > 0) or (post_prompt_messages and len(post_prompt_messages) > 0):
            print(f"🔄 Using message sequence for quick test")
            
            # Use message sequence method
            result = await self.detect_intent_with_message_sequence(
                agent_name=agent_name,
                session_id=session_id,
                pre_prompt_messages=pre_prompt_messages or [],
                main_question=prompt,
                post_prompt_messages=post_prompt_messages or [],
                language_code=language_code,
                session_parameters=session_parameters,
                playbook_id=playbook_id,
                enable_webhook=enable_webhook
            )
            
            # Format the result to match the expected quick_test response format
            return {
                "prompt": prompt,
                "response": result.get("response_text", ""),
                "agent_id": agent_id,
                "flow_id": flow_id,
                "page_id": page_id,
                "playbook_id": playbook_id,
                "model_id": model_id,
                "session_id": session_id,
                "response_time_ms": result.get("total_execution_time_ms", result.get("response_time_ms", 0)),
                "intent": result.get("intent", {}).get("display_name", ""),
                "confidence": result.get("intent_detection_confidence", 0.0),
                "parameters": result.get("parameters", {}),
                "response_messages": [result.get("response_text", "")],
                "webhook_info": result.get("webhook_info"),
                "is_mock": result.get("is_mock", False),
                "message_sequence": result.get("message_sequence", []),
                "sequence_summary": result.get("sequence_summary", {})
            }
        
        # Extract location from agent name for regional client
        location = self._extract_location_from_agent_name(agent_name)
        
        try:
            start_time = time.time()
            
            # Get regional sessions client for this location
            sessions_client = await self._get_regional_sessions_client(location)
            
            # Build session path using extracted location and project info
            agent_parts = agent_name.split('/')
            project_id = agent_parts[1]
            agent_uuid = agent_parts[5]
            session_path = f"projects/{project_id}/locations/{location}/agents/{agent_uuid}/sessions/{session_id}"
            
            # Create text input
            text_input = TextInput(text=prompt)
            query_input = QueryInput(text=text_input, language_code=language_code)
            
            # Build query parameters with session parameters and playbook support
            query_params_dict = {}
            if session_parameters:
                query_params_dict.update(session_parameters)
            
            # Initialize query_params object
            query_params = QueryParameters(parameters=query_params_dict) if query_params_dict else QueryParameters()
            
            # Set webhook configuration (default to enabled, disable if requested)
            query_params.disable_webhook = not enable_webhook
            if not enable_webhook:
                print(f"🚫 Webhooks disabled for this request")
            
            # Add playbook support if playbook_id is provided
            if playbook_id:
                if query_params is None:
                    query_params = QueryParameters()
                
                # Construct full playbook resource name from agent name and playbook ID
                playbook_resource_name = f"{agent_name}/playbooks/{playbook_id}"
                
                # Set current_playbook parameter for dynamic playbook selection
                query_params.current_playbook = playbook_resource_name
                print(f"🎭 Using playbook: {playbook_id}")
                print(f"🎭 Full playbook resource name: {playbook_resource_name}")
                
                # Add model configuration if provided
                if model_id:
                    print(f"🤖 Using model: {model_id}")
                    # Note: Model configuration might need to be set at the playbook level or agent level
            
            # Build detect intent request
            request = DetectIntentRequest(
                session=session_path,
                query_input=query_input,
                query_params=query_params
            )
            
            # Add flow and page context if specified (only for flows, not playbooks)
            if flow_id and not playbook_id:
                # In Dialogflow CX, flow and page are typically specified in the session context
                # For now, let's skip the flow/page specification and just use the default flow
                # This is a common approach when the specific flow/page targeting isn't critical
                print(f"ℹ️ Flow ID {flow_id} and Page ID {page_id} specified but using default flow for testing")
                pass
            
            # Make the API call using regional sessions client
            response = await asyncio.to_thread(
                sessions_client.detect_intent,
                request=request
            )
            
            end_time = time.time()
            response_time_ms = int((end_time - start_time) * 1000)

            # Convert protobuf response to a dictionary for serialization
            response_dict = DetectIntentResponse.to_dict(response)
            
            # Extract response data
            query_result = response.query_result
            
            # Debug: Print raw response structure
            print(f"🔍 Query result has {len(query_result.response_messages)} response messages")
            print(f"🔍 Query result intent: {query_result.intent.display_name if query_result.intent else 'None'}")
            print(f"🔍 Query result confidence: {query_result.intent_detection_confidence}")
            
            # Use consolidated webhook detection logic
            webhook_info = self._analyze_webhook_response(query_result, enable_webhook)

            # Extract response messages with enhanced debugging
            response_messages = []
            for i, message in enumerate(query_result.response_messages):
                print(f"🔍 Message {i}: type={type(message).__name__}")
                
                if hasattr(message, 'text') and message.text:
                    print(f"🔍 Message {i} has text: {message.text.text}")
                    response_messages.extend(message.text.text)
                elif hasattr(message, 'payload') and message.payload:
                    print(f"🔍 Message {i} has payload: {message.payload}")
                    # Try to extract text from payload if it exists
                    try:
                        payload_text = str(message.payload)
                        if payload_text and payload_text != "{}":
                            response_messages.append(f"[Payload: {payload_text}]")
                    except:
                        pass
                elif hasattr(message, 'live_agent_handoff'):
                    print(f"🔍 Message {i} is live agent handoff")
                    response_messages.append("[Live agent handoff requested]")
                elif hasattr(message, 'conversation_success'):
                    print(f"🔍 Message {i} is conversation success")
                    response_messages.append("[Conversation marked as successful]")
                else:
                    response_messages.append(f"[Unknown message type: {type(message).__name__}]")
            
            # Join messages into a single string for simple display
            final_response_text = "\n".join(response_messages)
            
            # Prepare result dictionary
            result = {
                "prompt": prompt,
                "response": final_response_text,
                "agent_id": agent_id,
                "flow_id": flow_id,
                "page_id": page_id,
                "playbook_id": playbook_id,
                "model_id": model_id,
                "session_id": session_id,
                "response_time_ms": response_time_ms,
                "intent": query_result.intent.display_name if query_result.intent else "No Intent",
                "confidence": query_result.intent_detection_confidence,
                "parameters": {k: v for k, v in query_result.parameters.items()} if query_result.parameters and hasattr(query_result.parameters, 'items') else {},
                "response_messages": response_messages,
                "webhook_info": webhook_info,
                "is_mock": False,
                "dialogflow_response": response_dict  # Add the full response dict
            }
            
            return result
            
        except Exception as e:
            print(f"❌ Error in quick_test: {e}")
            # Log the full traceback for debugging
            import traceback
            traceback.print_exc()
            raise

    async def detect_intent_with_message_sequence(
        self,
        agent_name: str,
        session_id: str,
        pre_prompt_messages: List[str],
        main_question: str,
        post_prompt_messages: List[str],
        language_code: str = "en",
        session_parameters: Optional[Dict[str, str]] = None,
        playbook_id: Optional[str] = None,
        enable_webhook: bool = True
    ) -> Dict[str, Any]:
        """
        Send a sequence of messages to Dialogflow within the same session:
        1. Pre-prompt initialization messages (to set context)
        2. Main question (the actual question to be evaluated)
        3. Post-prompt closing messages (for cleanup/confirmation)
        
        Args:
            agent_name: Full agent resource name
            session_id: Unique session identifier
            pre_prompt_messages: List of messages to send before the main question
            main_question: The primary question to be evaluated
            post_prompt_messages: List of messages to send after the main question
            language_code: Language code (default: en)
            session_parameters: Optional key-value pairs to pass as session parameters
            playbook_id: Optional playbook ID for conversation
            enable_webhook: Whether to enable webhooks
            
        Returns:
            Dictionary containing the main question's intent detection results
        """
        try:
            print(f"🔄 Starting message sequence for session: {session_id}")
            print(f"� Webhook configuration: enable_webhook={enable_webhook}")
            print(f"�📨 Pre-prompt messages: {len(pre_prompt_messages)} messages")
            print(f"❓ Main question: {main_question}")
            print(f"📨 Post-prompt messages: {len(post_prompt_messages)} messages")
            
            main_result = None
            all_responses = []
            start_time = time.time()
            
            # Step 1: Send pre-prompt initialization messages
            if pre_prompt_messages:
                print(f"📨 Sending {len(pre_prompt_messages)} pre-prompt messages...")
                for i, message in enumerate(pre_prompt_messages):
                    print(f"📨 Pre-prompt {i+1}: {message}")
                    result = await self.detect_intent(
                        agent_name=agent_name,
                        session_id=session_id,
                        text_input=message,
                        language_code=language_code,
                        session_parameters=session_parameters,
                        playbook_id=playbook_id,
                        enable_webhook=enable_webhook
                    )
                    all_responses.append({
                        "type": "pre_prompt",
                        "message": message,
                        "response": result.get("response_text", ""),
                        "intent": result.get("intent", {}).get("display_name", "")
                    })
                    print(f"📨 Pre-prompt {i+1} response: {result.get('response_text', '')}")
                    
                    # Small delay between pre-prompt messages to ensure session continuity
                    if i < len(pre_prompt_messages) - 1:
                        await asyncio.sleep(0.1)
            
            # Step 2: Send the main question (this is what gets evaluated)
            print(f"❓ Sending main question: {main_question}")
            main_result = await self.detect_intent(
                agent_name=agent_name,
                session_id=session_id,
                text_input=main_question,
                language_code=language_code,
                session_parameters=session_parameters,
                playbook_id=playbook_id,
                enable_webhook=enable_webhook
            )
            
            all_responses.append({
                "type": "main_question",
                "message": main_question,
                "response": main_result.get("response_text", ""),
                "intent": main_result.get("intent", {}).get("display_name", "")
            })
            print(f"❓ Main question response: {main_result.get('response_text', '')}")
            
            # Step 3: Send post-prompt closing messages
            if post_prompt_messages:
                print(f"📨 Sending {len(post_prompt_messages)} post-prompt messages...")
                # Small delay before post-prompt messages
                await asyncio.sleep(0.1)
                
                for i, message in enumerate(post_prompt_messages):
                    print(f"📨 Post-prompt {i+1}: {message}")
                    result = await self.detect_intent(
                        agent_name=agent_name,
                        session_id=session_id,
                        text_input=message,
                        language_code=language_code,
                        session_parameters=session_parameters,
                        playbook_id=playbook_id,
                        enable_webhook=enable_webhook
                    )
                    all_responses.append({
                        "type": "post_prompt",
                        "message": message,
                        "response": result.get("response_text", ""),
                        "intent": result.get("intent", {}).get("display_name", "")
                    })
                    print(f"📨 Post-prompt {i+1} response: {result.get('response_text', '')}")
                    
                    # Small delay between post-prompt messages
                    if i < len(post_prompt_messages) - 1:
                        await asyncio.sleep(0.1)
            
            # Calculate total execution time
            total_execution_time = int((time.time() - start_time) * 1000)
            
            # Return the main question's result enhanced with sequence information
            if main_result:
                main_result["total_execution_time_ms"] = total_execution_time
                main_result["message_sequence"] = all_responses
                main_result["sequence_summary"] = {
                    "pre_prompt_count": len(pre_prompt_messages),
                    "post_prompt_count": len(post_prompt_messages),
                    "total_messages": len(pre_prompt_messages) + 1 + len(post_prompt_messages)
                }
                print(f"✅ Message sequence completed in {total_execution_time}ms")
                return main_result
            else:
                raise Exception("Failed to get result from main question")
                
        except Exception as e:
            error_msg = str(e)
            print(f"❌ Error in message sequence: {error_msg}")
            
            # Provide more context about which part of the sequence failed
            if "pre_prompt_messages" in str(locals()) and "main_result" not in str(locals()):
                if pre_prompt_messages:
                    current_pre_prompt = len([r for r in all_responses if r.get("type") == "pre_prompt"]) + 1
                    if current_pre_prompt <= len(pre_prompt_messages):
                        raise Exception(f"Message sequence failed during pre-prompt message {current_pre_prompt} ('{pre_prompt_messages[current_pre_prompt-1]}'): {error_msg}")
                    else:
                        raise Exception(f"Message sequence failed after completing all {len(pre_prompt_messages)} pre-prompt messages: {error_msg}")
                else:
                    raise Exception(f"Message sequence failed during initialization: {error_msg}")
            elif "main_result" not in str(locals()) or main_result is None:
                completed_pre_prompts = len([r for r in all_responses if r.get("type") == "pre_prompt"])
                if completed_pre_prompts > 0:
                    raise Exception(f"Message sequence failed during main question ('{main_question}') after completing {completed_pre_prompts} pre-prompt messages: {error_msg}")
                else:
                    raise Exception(f"Message sequence failed during main question ('{main_question}'): {error_msg}")
            elif post_prompt_messages:
                completed_post_prompts = len([r for r in all_responses if r.get("type") == "post_prompt"])
                current_post_prompt = completed_post_prompts + 1
                if current_post_prompt <= len(post_prompt_messages):
                    raise Exception(f"Message sequence failed during post-prompt message {current_post_prompt} ('{post_prompt_messages[current_post_prompt-1]}'): {error_msg}")
                else:
                    raise Exception(f"Message sequence failed after completing main question and all post-prompt messages: {error_msg}")
            else:
                raise Exception(f"Message sequence failed: {error_msg}")

    async def get_agent_flows(self, agent_id: str) -> List[Dict[str, str]]:
        """Get flows for a specific agent by ID. 
        The agent_id can be either a simple ID or a full agent path.
        If it's a simple ID, we'll find the agent's location and construct the full path.
        """
        # Check if agent_id is already a full path
        if agent_id.startswith("projects/"):
            agent_name = agent_id
        else:
            # Find the agent across all locations to get its full name
            agent_name = await self._find_agent_full_name(agent_id)
            if not agent_name:
                raise Exception(f"Agent with ID {agent_id} not found in any location")
        
        return await self.list_flows(agent_name)
        
    async def get_flow_pages(self, agent_id: str, flow_id: str) -> List[Dict[str, str]]:
        """Get pages for a specific flow by agent and flow ID.
        The agent_id can be either a simple ID or a full agent path.
        If it's a simple ID, we'll find the agent's location dynamically.
        """
        # Check if agent_id is already a full path
        if agent_id.startswith("projects/"):
            agent_name = agent_id
        else:
            # Find the agent's full name with correct location
            agent_name = await self._find_agent_full_name(agent_id)
            if not agent_name:
                raise Exception(f"Agent with ID {agent_id} not found in any location")
        
        flow_name = f"{agent_name}/flows/{flow_id}"
        return await self.list_pages(flow_name)
