# App Integration Guide

How to integrate the Feedback & Tickets system into your Flutter, Android, or iOS app.

---

## Overview

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Mobile App     │ ──API──▶│  Feedback Server  │◀──Web──│  Admin Panel    │
│  (Flutter/etc.)  │         │  (Node.js)        │         │  (React)        │
└─────────────────┘         └──────────────────┘         └─────────────────┘
       │                            │
       │ Google Sign-In             │ MySQL
       ▼                            ▼
┌─────────────────┐         ┌──────────────────┐
│  Google OAuth    │         │    Database       │
└─────────────────┘         └──────────────────┘
```

**Flow:**
1. User signs in with Google in your app
2. App sends Google ID token + API key to the server
3. Server verifies the token, creates/finds the user, returns a JWT
4. App uses the JWT + API key for all subsequent requests
5. Users can create tickets, add comments, submit feedback
6. Admins manage everything from the admin panel

---

## Step 1: Get Your Credentials

From the admin panel (**Apps** page):

| Credential | Where to find | Used for |
|------------|---------------|----------|
| **API Key** | Auto-generated when app is registered | `x-api-key` header in all requests |
| **Google Client ID** (Web type) | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → OAuth 2.0 Client IDs → Web application | Server-side token verification |
| **Server URL** | Your deployment URL | API base URL |

> **Important:** The Google Client ID entered in the admin panel must be the **Web application** type, not Android/iOS. Your mobile app uses this as the `serverClientId`.

---

## Step 2: Setup Google Sign-In

### Flutter

Add dependencies to `pubspec.yaml`:

```yaml
dependencies:
  google_sign_in: ^6.2.1
  http: ^1.2.0
```

Configure Google Sign-In:

```dart
import 'package:google_sign_in/google_sign_in.dart';

// Use the Web Client ID from the admin panel
final GoogleSignIn _googleSignIn = GoogleSignIn(
  serverClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
  scopes: ['email', 'profile'],
);
```

### Android Native

Add to `app/build.gradle`:

```gradle
dependencies {
    implementation 'com.google.android.gms:play-services-auth:21.0.0'
}
```

### iOS

Add `GoogleService-Info.plist` to your project and configure URL schemes.

---

## Step 3: Authentication

### Login Flow

```
App                          Server
 │                             │
 │  1. Google Sign-In          │
 │  ──────────────────▶        │
 │  (get idToken)              │
 │                             │
 │  2. POST /auth/google       │
 │  { idToken }                │
 │  x-api-key: fb_xxx          │
 │  ──────────────────▶        │
 │                             │
 │  3. { token, user }         │
 │  ◀──────────────────        │
 │                             │
 │  4. Store JWT token         │
 │  (for future requests)      │
 │                             │
```

### Flutter Implementation

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

const String baseUrl = 'https://feedbacktickets.myportfoliodata.com/api';
const String apiKey = 'fb_your_api_key_here';

String? _jwtToken;
Map<String, dynamic>? _currentUser;

// Headers for authenticated requests
Map<String, String> get _headers => {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer $_jwtToken',
  'x-api-key': apiKey,
};

/// Sign in with Google and authenticate with the feedback server
Future<bool> signIn() async {
  try {
    // 1. Google Sign-In
    final account = await _googleSignIn.signIn();
    if (account == null) return false;

    final auth = await account.authentication;
    final idToken = auth.idToken;
    if (idToken == null) return false;

    // 2. Send token to feedback server
    final res = await http.post(
      Uri.parse('$baseUrl/auth/google'),
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: jsonEncode({'idToken': idToken}),
    );

    if (res.statusCode != 200) return false;

    // 3. Store JWT and user info
    final data = jsonDecode(res.body);
    _jwtToken = data['token'];
    _currentUser = data['user'];
    return true;
  } catch (e) {
    print('Sign-in error: $e');
    return false;
  }
}

/// Sign out
Future<void> signOut() async {
  await _googleSignIn.signOut();
  _jwtToken = null;
  _currentUser = null;
}
```

---

## Step 4: Tickets

### Create a Ticket

```dart
/// Create a new support ticket
Future<Map<String, dynamic>?> createTicket({
  required String title,
  required String description,
  String priority = 'medium', // low, medium, high, critical
  String? category,
}) async {
  final res = await http.post(
    Uri.parse('$baseUrl/tickets'),
    headers: _headers,
    body: jsonEncode({
      'title': title,
      'description': description,
      'priority': priority,
      if (category != null) 'category': category,
    }),
  );

  if (res.statusCode == 201) {
    return jsonDecode(res.body);
  }
  return null;
}
```

### List My Tickets

```dart
/// Get paginated list of user's tickets
Future<Map<String, dynamic>> getMyTickets({int page = 1, int limit = 20}) async {
  final res = await http.get(
    Uri.parse('$baseUrl/tickets?page=$page&limit=$limit'),
    headers: _headers,
  );

  final data = jsonDecode(res.body);
  // Returns: { tickets: [...], total: 42, page: 1, totalPages: 3 }
  return data;
}
```

### Get Ticket Detail

```dart
/// Get full ticket detail with comments, attachments, and history
Future<Map<String, dynamic>?> getTicketDetail(String ticketId) async {
  final res = await http.get(
    Uri.parse('$baseUrl/tickets/$ticketId'),
    headers: _headers,
  );

  if (res.statusCode == 200) {
    return jsonDecode(res.body);
    // Returns ticket with: comments[], attachments[], history[]
  }
  return null;
}
```

### Add Comment to Ticket

```dart
/// Add a comment to an existing ticket
Future<Map<String, dynamic>?> addComment(String ticketId, String body) async {
  final res = await http.post(
    Uri.parse('$baseUrl/tickets/$ticketId/comments'),
    headers: _headers,
    body: jsonEncode({'body': body}),
  );

  if (res.statusCode == 201) {
    return jsonDecode(res.body);
  }
  return null;
}
```

### Upload Attachment

```dart
import 'package:http/http.dart' as http;

/// Upload a file attachment to a ticket
Future<Map<String, dynamic>?> uploadAttachment(String ticketId, String filePath, String fileName) async {
  final request = http.MultipartRequest(
    'POST',
    Uri.parse('$baseUrl/tickets/$ticketId/attachments'),
  );
  request.headers['Authorization'] = 'Bearer $_jwtToken';
  request.headers['x-api-key'] = apiKey;
  request.files.add(await http.MultipartFile.fromPath('file', filePath, filename: fileName));

  final streamedRes = await request.send();
  final res = await http.Response.fromStream(streamedRes);

  if (res.statusCode == 201) {
    return jsonDecode(res.body);
  }
  return null;
}
```

---

## Step 5: Feedback

### Submit Feedback

```dart
/// Submit a feedback rating with optional comment
Future<Map<String, dynamic>?> submitFeedback({
  required int rating, // 1-5 stars
  String? comment,
  String category = 'general', // bug_report, feature_request, suggestion, complaint, general
}) async {
  final res = await http.post(
    Uri.parse('$baseUrl/feedbacks'),
    headers: _headers,
    body: jsonEncode({
      'rating': rating,
      if (comment != null) 'comment': comment,
      'category': category,
    }),
  );

  if (res.statusCode == 201) {
    return jsonDecode(res.body);
  }
  return null;
}
```

### List My Feedbacks

```dart
/// Get paginated list of user's feedbacks
Future<Map<String, dynamic>> getMyFeedbacks({int page = 1}) async {
  final res = await http.get(
    Uri.parse('$baseUrl/feedbacks?page=$page'),
    headers: _headers,
  );

  return jsonDecode(res.body);
  // Returns: { feedbacks: [...], total: 15, page: 1, totalPages: 1 }
}
```

### Get Feedback Detail (with replies)

```dart
/// Get feedback detail including admin replies
Future<Map<String, dynamic>?> getFeedbackDetail(String feedbackId) async {
  final res = await http.get(
    Uri.parse('$baseUrl/feedbacks/$feedbackId'),
    headers: _headers,
  );

  if (res.statusCode == 200) {
    return jsonDecode(res.body);
    // Returns feedback with: replies[], attachments[]
  }
  return null;
}
```

---

## Step 6: Complete Service Class

Here's a ready-to-use service class for Flutter:

```dart
import 'dart:convert';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;

class FeedbackService {
  static const String _baseUrl = 'https://your-server.com/api';
  static const String _apiKey = 'fb_your_api_key';

  static String? _token;
  static Map<String, dynamic>? currentUser;

  static final GoogleSignIn _googleSignIn = GoogleSignIn(
    serverClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
    scopes: ['email', 'profile'],
  );

  static Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer $_token',
    'x-api-key': _apiKey,
  };

  static bool get isLoggedIn => _token != null;

  // ── Auth ──────────────────────────────────────────

  static Future<bool> signIn() async {
    try {
      final account = await _googleSignIn.signIn();
      if (account == null) return false;

      final auth = await account.authentication;
      if (auth.idToken == null) return false;

      final res = await http.post(
        Uri.parse('$_baseUrl/auth/google'),
        headers: {'Content-Type': 'application/json', 'x-api-key': _apiKey},
        body: jsonEncode({'idToken': auth.idToken}),
      );

      if (res.statusCode != 200) return false;
      final data = jsonDecode(res.body);
      _token = data['token'];
      currentUser = data['user'];
      return true;
    } catch (e) {
      print('FeedbackService signIn error: $e');
      return false;
    }
  }

  static Future<void> signOut() async {
    await _googleSignIn.signOut();
    _token = null;
    currentUser = null;
  }

  // ── Tickets ───────────────────────────────────────

  static Future<Map<String, dynamic>?> createTicket({
    required String title,
    required String description,
    String priority = 'medium',
    String? category,
  }) async {
    final res = await http.post(
      Uri.parse('$_baseUrl/tickets'),
      headers: _headers,
      body: jsonEncode({
        'title': title,
        'description': description,
        'priority': priority,
        if (category != null) 'category': category,
      }),
    );
    return res.statusCode == 201 ? jsonDecode(res.body) : null;
  }

  static Future<Map<String, dynamic>> getTickets({int page = 1}) async {
    final res = await http.get(
      Uri.parse('$_baseUrl/tickets?page=$page'),
      headers: _headers,
    );
    return jsonDecode(res.body);
  }

  static Future<Map<String, dynamic>?> getTicket(String id) async {
    final res = await http.get(
      Uri.parse('$_baseUrl/tickets/$id'),
      headers: _headers,
    );
    return res.statusCode == 200 ? jsonDecode(res.body) : null;
  }

  static Future<Map<String, dynamic>?> addComment(String ticketId, String body) async {
    final res = await http.post(
      Uri.parse('$_baseUrl/tickets/$ticketId/comments'),
      headers: _headers,
      body: jsonEncode({'body': body}),
    );
    return res.statusCode == 201 ? jsonDecode(res.body) : null;
  }

  static Future<Map<String, dynamic>?> uploadAttachment(String ticketId, String filePath, String fileName) async {
    final request = http.MultipartRequest('POST', Uri.parse('$_baseUrl/tickets/$ticketId/attachments'));
    request.headers['Authorization'] = 'Bearer $_token';
    request.headers['x-api-key'] = _apiKey;
    request.files.add(await http.MultipartFile.fromPath('file', filePath, filename: fileName));
    final streamedRes = await request.send();
    final res = await http.Response.fromStream(streamedRes);
    return res.statusCode == 201 ? jsonDecode(res.body) : null;
  }

  // ── Feedback ──────────────────────────────────────

  static Future<Map<String, dynamic>?> submitFeedback({
    required int rating,
    String? comment,
    String category = 'general',
  }) async {
    final res = await http.post(
      Uri.parse('$_baseUrl/feedbacks'),
      headers: _headers,
      body: jsonEncode({
        'rating': rating,
        if (comment != null) 'comment': comment,
        'category': category,
      }),
    );
    return res.statusCode == 201 ? jsonDecode(res.body) : null;
  }

  static Future<Map<String, dynamic>> getFeedbacks({int page = 1}) async {
    final res = await http.get(
      Uri.parse('$_baseUrl/feedbacks?page=$page'),
      headers: _headers,
    );
    return jsonDecode(res.body);
  }

  static Future<Map<String, dynamic>?> getFeedback(String id) async {
    final res = await http.get(
      Uri.parse('$_baseUrl/feedbacks/$id'),
      headers: _headers,
    );
    return res.statusCode == 200 ? jsonDecode(res.body) : null;
  }

  static Future<Map<String, dynamic>?> uploadFeedbackAttachment(String feedbackId, String filePath, String fileName) async {
    final request = http.MultipartRequest('POST', Uri.parse('$_baseUrl/feedbacks/$feedbackId/attachments'));
    request.headers['Authorization'] = 'Bearer $_token';
    request.headers['x-api-key'] = _apiKey;
    request.files.add(await http.MultipartFile.fromPath('file', filePath, filename: fileName));
    final streamedRes = await request.send();
    final res = await http.Response.fromStream(streamedRes);
    return res.statusCode == 201 ? jsonDecode(res.body) : null;
  }
}
```

---

## Step 7: UI Examples

### Feedback Dialog (Flutter)

```dart
import 'package:flutter/material.dart';

class FeedbackDialog extends StatefulWidget {
  const FeedbackDialog({super.key});

  @override
  State<FeedbackDialog> createState() => _FeedbackDialogState();
}

class _FeedbackDialogState extends State<FeedbackDialog> {
  int _rating = 0;
  String _category = 'general';
  final _commentController = TextEditingController();
  bool _submitting = false;

  final categories = [
    {'value': 'general', 'label': 'General'},
    {'value': 'bug_report', 'label': 'Bug Report'},
    {'value': 'feature_request', 'label': 'Feature Request'},
    {'value': 'suggestion', 'label': 'Suggestion'},
    {'value': 'complaint', 'label': 'Complaint'},
  ];

  Future<void> _submit() async {
    if (_rating == 0) return;
    setState(() => _submitting = true);

    final result = await FeedbackService.submitFeedback(
      rating: _rating,
      comment: _commentController.text.isNotEmpty ? _commentController.text : null,
      category: _category,
    );

    setState(() => _submitting = false);

    if (result != null && mounted) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Thank you for your feedback!')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Rate this app'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Star rating
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(5, (i) {
              return IconButton(
                icon: Icon(
                  i < _rating ? Icons.star : Icons.star_border,
                  color: Colors.amber,
                  size: 36,
                ),
                onPressed: () => setState(() => _rating = i + 1),
              );
            }),
          ),
          const SizedBox(height: 12),
          // Category dropdown
          DropdownButtonFormField<String>(
            value: _category,
            decoration: const InputDecoration(labelText: 'Category', border: OutlineInputBorder()),
            items: categories.map((c) {
              return DropdownMenuItem(value: c['value'], child: Text(c['label']!));
            }).toList(),
            onChanged: (v) => setState(() => _category = v!),
          ),
          const SizedBox(height: 12),
          // Comment
          TextField(
            controller: _commentController,
            decoration: const InputDecoration(
              labelText: 'Comment (optional)',
              border: OutlineInputBorder(),
            ),
            maxLines: 3,
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        ElevatedButton(
          onPressed: _rating > 0 && !_submitting ? _submit : null,
          child: _submitting ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Submit'),
        ),
      ],
    );
  }
}

// Usage: showDialog(context: context, builder: (_) => const FeedbackDialog());
```

### Create Ticket Screen (Flutter)

```dart
import 'package:flutter/material.dart';

class CreateTicketScreen extends StatefulWidget {
  const CreateTicketScreen({super.key});

  @override
  State<CreateTicketScreen> createState() => _CreateTicketScreenState();
}

class _CreateTicketScreenState extends State<CreateTicketScreen> {
  final _titleController = TextEditingController();
  final _descController = TextEditingController();
  String _priority = 'medium';
  bool _submitting = false;

  Future<void> _submit() async {
    if (_titleController.text.isEmpty || _descController.text.isEmpty) return;
    setState(() => _submitting = true);

    final result = await FeedbackService.createTicket(
      title: _titleController.text,
      description: _descController.text,
      priority: _priority,
    );

    setState(() => _submitting = false);

    if (result != null && mounted) {
      Navigator.pop(context, result);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Ticket created successfully!')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Create Ticket')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            TextField(
              controller: _titleController,
              decoration: const InputDecoration(labelText: 'Title *', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _descController,
              decoration: const InputDecoration(labelText: 'Description *', border: OutlineInputBorder()),
              maxLines: 5,
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _priority,
              decoration: const InputDecoration(labelText: 'Priority', border: OutlineInputBorder()),
              items: const [
                DropdownMenuItem(value: 'low', child: Text('Low')),
                DropdownMenuItem(value: 'medium', child: Text('Medium')),
                DropdownMenuItem(value: 'high', child: Text('High')),
                DropdownMenuItem(value: 'critical', child: Text('Critical')),
              ],
              onChanged: (v) => setState(() => _priority = v!),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: !_submitting ? _submit : null,
                child: _submitting
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Submit Ticket'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
```

### Ticket List Screen (Flutter)

```dart
import 'package:flutter/material.dart';

class TicketListScreen extends StatefulWidget {
  const TicketListScreen({super.key});

  @override
  State<TicketListScreen> createState() => _TicketListScreenState();
}

class _TicketListScreenState extends State<TicketListScreen> {
  List<dynamic> _tickets = [];
  bool _loading = true;
  int _page = 1;
  int _totalPages = 1;

  @override
  void initState() {
    super.initState();
    _loadTickets();
  }

  Future<void> _loadTickets() async {
    setState(() => _loading = true);
    final data = await FeedbackService.getTickets(page: _page);
    setState(() {
      _tickets = data['tickets'];
      _totalPages = data['totalPages'];
      _loading = false;
    });
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'open': return Colors.blue;
      case 'in_progress': return Colors.orange;
      case 'resolved': return Colors.green;
      case 'closed': return Colors.grey;
      default: return Colors.grey;
    }
  }

  Color _priorityColor(String priority) {
    switch (priority) {
      case 'critical': return Colors.red;
      case 'high': return Colors.orange;
      case 'medium': return Colors.amber;
      case 'low': return Colors.green;
      default: return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Tickets')),
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          final result = await Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const CreateTicketScreen()),
          );
          if (result != null) _loadTickets();
        },
        child: const Icon(Icons.add),
      ),
      body: _loading
        ? const Center(child: CircularProgressIndicator())
        : RefreshIndicator(
            onRefresh: _loadTickets,
            child: ListView.builder(
              itemCount: _tickets.length,
              itemBuilder: (context, index) {
                final ticket = _tickets[index];
                return ListTile(
                  title: Text(ticket['title'], maxLines: 1, overflow: TextOverflow.ellipsis),
                  subtitle: Text('${ticket['status']} · ${ticket['priority']} priority'),
                  leading: CircleAvatar(
                    backgroundColor: _statusColor(ticket['status']),
                    child: Text(ticket['_count']['comments'].toString(), style: const TextStyle(color: Colors.white, fontSize: 12)),
                  ),
                  trailing: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: _priorityColor(ticket['priority']).withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(ticket['priority'], style: TextStyle(fontSize: 11, color: _priorityColor(ticket['priority']))),
                  ),
                  onTap: () {
                    // Navigate to ticket detail
                  },
                );
              },
            ),
          ),
    );
  }
}
```

---

## Error Handling

All API errors return `{ "error": "description" }`. Handle common cases:

```dart
Future<T?> _apiCall<T>(Future<http.Response> Function() call, T Function(String body) parse) async {
  try {
    final res = await call();

    switch (res.statusCode) {
      case 200:
      case 201:
        return parse(res.body);
      case 401:
        // Token expired — re-authenticate
        await signOut();
        // Navigate to login screen
        return null;
      case 403:
        // User is banned or insufficient permissions
        return null;
      default:
        final error = jsonDecode(res.body)['error'];
        print('API error: $error');
        return null;
    }
  } catch (e) {
    print('Network error: $e');
    return null;
  }
}
```

---

## Token Management

JWT tokens expire after **7 days**. Best practices:

```dart
import 'package:shared_preferences/shared_preferences.dart';

// Save token after login
Future<void> _saveToken(String token) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString('feedback_jwt', token);
}

// Load token on app start
Future<void> _loadToken() async {
  final prefs = await SharedPreferences.getInstance();
  _token = prefs.getString('feedback_jwt');
}

// Clear token on logout or 401
Future<void> _clearToken() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.remove('feedback_jwt');
  _token = null;
}
```

---

## Quick Checklist

- [ ] Register your app in the admin panel
- [ ] Copy the **API Key** from the admin panel
- [ ] Create a **Web** OAuth client ID in Google Cloud Console
- [ ] Paste the Web Client ID in the app settings (admin panel)
- [ ] Create **Android/iOS** OAuth client IDs in the same Google project
- [ ] Configure Google Sign-In in your app with `serverClientId` = Web Client ID
- [ ] Initialize `FeedbackService` with your API key and server URL
- [ ] Test: Sign in → Create ticket → Add comment → Submit feedback
- [ ] (Optional) Set up Firebase and register FCM token for push notifications
- [ ] Deploy and update the server URL to production

---

## Push Notifications (FCM)

Send push notifications to users when their tickets are updated or feedback receives a reply.

### 1. Firebase Setup

1. Add Firebase to your Flutter project: [FlutterFire docs](https://firebase.google.com/docs/flutter/setup)
2. In the Firebase Console, go to **Project Settings → Service accounts → Generate new private key**
3. In the admin panel, edit your app and paste: **Project ID**, **Client Email**, and **Private Key**

### 2. Dependencies

```yaml
# pubspec.yaml
dependencies:
  firebase_core: ^3.0.0
  firebase_messaging: ^15.0.0
```

### 3. Initialize and Register Token

```dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

// In your main.dart or after login:
await Firebase.initializeApp();
final fcmToken = await FirebaseMessaging.instance.getToken();
if (fcmToken != null) {
  await FeedbackService.registerDeviceToken(fcmToken);
}

// Listen for token refresh
FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
  FeedbackService.registerDeviceToken(newToken);
});
```

### 4. Add to FeedbackService

```dart
// Add these methods to FeedbackService:

static Future<void> registerDeviceToken(String token) async {
  await _post('/device-tokens', {
    'token': token,
    'platform': Platform.isAndroid ? 'android' : 'ios',
  });
}

static Future<void> removeDeviceToken(String token) async {
  await http.delete(
    Uri.parse('$_baseUrl/device-tokens'),
    headers: _headers(),
    body: jsonEncode({'token': token}),
  );
}
```

### 5. Handle Incoming Notifications

```dart
// Foreground messages
FirebaseMessaging.onMessage.listen((RemoteMessage message) {
  // Show local notification or in-app banner
  final title = message.notification?.title ?? '';
  final body = message.notification?.body ?? '';
  // Use flutter_local_notifications to show a notification
});

// Background/terminated tap handler
FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
  final type = message.data['type']; // "ticket_update", "new_comment", "feedback_reply"
  final ticketId = message.data['ticketId'];
  final feedbackId = message.data['feedbackId'];
  // Navigate to the relevant screen
});
```

### 6. Unregister on Logout

```dart
Future<void> logout() async {
  final token = await FirebaseMessaging.instance.getToken();
  if (token != null) {
    await FeedbackService.removeDeviceToken(token);
  }
  // Clear stored JWT, navigate to login...
}
```
