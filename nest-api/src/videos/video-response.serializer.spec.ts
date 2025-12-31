import { normalizeVideoResponse, normalizeVideoListResponse, validateVideoResponse } from './video-response.serializer';

describe('VideoResponseSerializer', () => {
  describe('normalizeVideoResponse', () => {
    it('should add backward-compatible fields', () => {
      const input = {
        id: 'test-id',
        video_id: 'dQw4w9WgXcQ',
        youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        platform: 'youtube',
        title: 'Test Video',
        management_id: '250115-01',
        view_count: 100,
        created_at: '2025-01-15T10:00:00Z',
      };

      const result = normalizeVideoResponse(input);

      expect(result.youtube_id).toBe('dQw4w9WgXcQ');
      expect(result.source_url).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(result.view_count).toBe(100);
      expect(result.views).toBe(100);
    });

    it('should handle missing fields gracefully', () => {
      const input = {
        id: 'test-id',
        platform: 'youtube',
      };

      const result = normalizeVideoResponse(input);

      expect(result.youtube_id).toBeNull();
      expect(result.source_url).toBeNull();
      expect(result.management_id).toBeNull();
      expect(result.view_count).toBe(0);
      expect(result.views).toBe(0);
    });

    it('should preserve original fields', () => {
      const input = {
        id: 'test-id',
        video_id: 'dQw4w9WgXcQ',
        platform: 'youtube',
        custom_field: 'custom-value',
      };

      const result = normalizeVideoResponse(input);

      expect(result.video_id).toBe('dQw4w9WgXcQ');
      expect(result.custom_field).toBe('custom-value');
    });
  });

  describe('normalizeVideoListResponse', () => {
    it('should normalize array of videos', () => {
      const input = [
        { id: '1', video_id: 'abc', platform: 'youtube' },
        { id: '2', video_id: 'def', platform: 'facebook' },
      ];

      const result = normalizeVideoListResponse(input);

      expect(result).toHaveLength(2);
      expect(result[0].youtube_id).toBe('abc');
      expect(result[1].youtube_id).toBe('def');
    });

    it('should handle empty array', () => {
      const result = normalizeVideoListResponse([]);
      expect(result).toHaveLength(0);
    });

    it('should handle non-array input', () => {
      const result = normalizeVideoListResponse(null as any);
      expect(result).toHaveLength(0);
    });
  });

  describe('validateVideoResponse', () => {
    it('should validate complete video response', () => {
      const video = {
        id: 'test-id',
        platform: 'youtube',
        youtube_id: 'dQw4w9WgXcQ',
        source_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        management_id: '250115-01',
        title: 'Test',
        thumbnail_url: 'https://example.com/thumb.jpg',
        view_count: 100,
        created_at: '2025-01-15T10:00:00Z',
      };

      const result = validateVideoResponse(video);

      expect(result.valid).toBe(true);
      expect(result.missingFields).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const video = {
        id: 'test-id',
        platform: 'youtube',
        // missing: youtube_id, source_url, management_id, etc.
      };

      const result = validateVideoResponse(video);

      expect(result.valid).toBe(false);
      expect(result.missingFields.length).toBeGreaterThan(0);
      expect(result.missingFields).toContain('youtube_id');
      expect(result.missingFields).toContain('source_url');
    });
  });
});



