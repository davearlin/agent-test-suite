# Agent Permission Filtering

## Problem Statement

Users were encountering IAM permission errors when trying to test Dialogflow agents they didn't have access to:
```
Permission error: You don't have sufficient permissions to access this Dialogflow agent
403 IAM permission 'dialogflow.sessions.detectIntent' denied
```

### Root Cause
Users had `dialogflow.agents.get` permission (to list agents) but NOT `dialogflow.sessions.detectIntent` permission (to send messages). This caused agents to appear in dropdowns but fail when trying to send test messages.

## User Experience

**Before Filtering:**
1. User selects project
2. Sees all 10 agents in dropdown
3. Selects agent they don't have access to
4. Sends test message
5. ❌ Gets permission error: "403 IAM permission denied"

**After Filtering (Current Implementation):**
1. User selects project
2. Agent dropdown shows:
   - **Available Agents** section (6 agents) - Normal styling, fully selectable
   - **Unavailable Agents (View Only)** section (4 agents) - Labeled with "(No Access)" suffix, selectable for browsing
3. User can select **any** agent (accessible or inaccessible)
4. For accessible agents: Can browse flows/pages AND send test messages
5. For inaccessible agents: Can browse flows/pages but "Send Test"/"Create Test Run" buttons are disabled
6. Visual indicators show inaccessible agents with red "No Access" chip and error-state TextField

**Design Benefits:**
- ✅ Users can see ALL agents that exist in the project
- ✅ Clear visual distinction between available and unavailable agents
- ✅ Can browse flows/pages/configuration of inaccessible agents
- ✅ Prevents sending test messages to inaccessible agents (buttons disabled)
- ✅ Helpful for requesting access to specific agents from administrators
- ✅ Red "No Access" chip provides immediate visual feedback

## Solution Options Considered

### Option 1: Programmatic Permission Assignment ❌
**Why Not Viable:**
- Would require `resourcemanager.projects.setIamPolicy` or similar admin-level permissions
- Major security risk to let application modify IAM policies
- Violates enterprise security best practices

### Option 2: Filter Inaccessible Agents ✅ IMPLEMENTED
**Why This is Better:**
- Industry standard approach (Google, AWS, Azure all do this)
- Maintains security without requiring elevated privileges
- Better user experience - users only see agents they can actually use
- No error messages or confusion

## Implementation Details

### Permission Testing Strategy
We test each agent's accessibility by calling the `dialogflow.sessions.detectIntent` API with a minimal test message:
- **Actual permission test** - tests the EXACT permission needed (`dialogflow.sessions.detectIntent`)
- **Lightweight test message** - uses minimal "test" text to minimize processing
- **Quick failure** - permission denied errors return immediately
- **Note**: Previously tested `dialogflow.agents.get` but users can have that WITHOUT `detectIntent` permission

### Performance Optimizations

#### 1. Parallel Permission Checking ⚡ NEW
Permission checks for all agents are executed in parallel using `asyncio.gather()`:
```python
permission_tasks = [self._test_agent_access(agent.name, location) for agent in agents]
permission_results = await asyncio.gather(*permission_tasks, return_exceptions=True)
```

**Benefits:**
- Checks 78 agents simultaneously (not sequentially)
- Reduces first load time from ~78 seconds to ~3-5 seconds
- Scales efficiently with large agent lists

#### 2. Permission Cache
```python
# Cache format: {(user_id, agent_name): {"accessible": bool, "timestamp": float, "ttl": 3600}}
_permission_cache = {}
_permission_cache_ttl = 3600  # 1 hour
```

**Benefits:**
- Avoids repeated API calls for the same agent
- First agent list load: Permission checks run in parallel
- Subsequent loads (within 1 hour): 0 API calls (all from cache)
- Cache expires after 1 hour to reflect IAM changes

#### 3. Agent List Cache
```python
# Cache format: {(user_id, project_id): {"agents": [...], "timestamp": float, "ttl": 3600}}
_agent_cache = {}
_cache_ttl = 3600  # 1 hour
```

**Benefits:**
- Caches the entire agent list with permission data
- Combines with permission cache for optimal performance
- Only re-queries when cache expires or user changes projects

#### 4. Parallel Location Search
The `_list_agents_by_locations()` method searches multiple locations in parallel using `asyncio.gather()`:
```python
location_results = await asyncio.gather(
    *[self._search_agents_in_location(location) for location in locations],
    return_exceptions=True
)
```

**Benefits:**
- Searches 6 locations simultaneously (not sequentially)
- Reduces total search time from ~6 seconds to ~1 second

### Performance Characteristics

| Scenario | First Load | With Cache | Notes |
|----------|------------|------------|-------|
| 10 agents | ~1-2 seconds | ~0.1 seconds | Parallel permission checks |
| 50 agents | ~3-4 seconds | ~0.1 seconds | Parallel permission checks |
| 78 agents | ~4-6 seconds | ~0.1 seconds | Parallel permission checks |
| After 5 minutes | Same as first load | ~0.1 seconds | Cache expires, rebuilds |

### Cache Management

#### Clear Permission Cache
```python
# Clear for specific user
DialogflowService.clear_permission_cache(user_id=123)

# Clear all permission cache entries
DialogflowService.clear_permission_cache()
```

#### Clear Agent Cache
```python
# Clear for specific user/project
DialogflowService.clear_agent_cache(user_id=123, project_id="my-project")

# Clear all agent cache entries
DialogflowService.clear_agent_cache()
```

## Frontend Implementation

### Visual Indicators
When an inaccessible agent is selected, multiple visual cues are displayed:
- **Red "No Access" Chip**: Appears as startAdornment in the TextField
- **Error State**: TextField border turns red
- **Helper Text**: Shows "This agent is unavailable - you do not have detectIntent permission"
- **Disabled Buttons**: "Send Test" and "Create Test Run" buttons are disabled

### Agent Dropdown Groups
Agents are displayed in two sections using MUI Autocomplete grouping:
- **"Available Agents"**: Agents with `accessible: true`
- **"Unavailable Agents (View Only)"**: Agents with `accessible: false`, labeled with "(No Access)" suffix

### Refresh Button
A refresh icon (🔄) button is available in the agent dropdown to manually refresh the agent list and clear caches

## Limitations & Considerations

### Cache Staleness
- **Problem**: If admin grants permission, user won't see new agents for up to 5 minutes
- **Workaround**: Add manual refresh button (like model cache has)
- **Acceptable**: Most IAM changes are infrequent

### Performance with Many Agents
- **Worst case**: 100 agents = ~30 seconds first load
- **Typical case**: 10-20 agents = ~2-3 seconds first load
- **Best case**: Cached load = ~0.1 seconds

### False Negatives
- **Problem**: Network errors treated as "no access" to be safe
- **Impact**: Users might not see agents during network issues
- **Mitigation**: Logs show "Error testing agent access" for debugging

## Testing Recommendations

1. **Test with multiple projects** - Verify filtering per project
2. **Test cache behavior** - List agents twice, verify second is faster
3. **Test permission changes** - Grant/revoke permission, wait 5 min, verify change appears
4. **Test with many agents** - Monitor performance with 20+ agents

## Future Improvements

1. **Manual Refresh Button** - Like model cache, add UI button to force cache clear
2. **Batch Permission Testing** - Use IAM policy API to test all agents at once (if Google supports it)
3. **Background Refresh** - Pre-warm cache before user requests
4. **Smarter TTL** - Shorter TTL for newly granted permissions, longer for stable access
