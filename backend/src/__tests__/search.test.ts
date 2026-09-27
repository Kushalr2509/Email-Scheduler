import { search, triggerBulkIndex } from '../controllers/searchController';
import { Request, Response } from 'express';
import { searchEmails, bulkIndexExisting, indexEmail } from '../services/elasticsearchService';

jest.mock('../services/elasticsearchService', () => ({
  searchEmails: jest.fn(),
  bulkIndexExisting: jest.fn(),
  indexEmail: jest.fn(),
}));

describe('Search Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockRequest = {
      user: { id: 'user-123' },
      query: { q: 'test' }
    };
    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  it('search should query by user ID and query string', async () => {
    (searchEmails as jest.Mock).mockResolvedValue([{ id: 'email-1' }]);

    await search(mockRequest as Request, mockResponse as Response);

    expect(searchEmails).toHaveBeenCalledWith('user-123', 'test');
    expect(mockResponse.json).toHaveBeenCalledWith([{ id: 'email-1' }]);
  });

  it('search should return 503 if elasticsearch fails', async () => {
    (searchEmails as jest.Mock).mockRejectedValue(new Error('Search is temporarily unavailable'));

    await search(mockRequest as Request, mockResponse as Response);

    expect(searchEmails).toHaveBeenCalledWith('user-123', 'test');
    expect(mockResponse.status).toHaveBeenCalledWith(503);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Search is temporarily unavailable' });
  });

  it('bulk index should call service', async () => {
    await triggerBulkIndex(mockRequest as Request, mockResponse as Response);
    expect(bulkIndexExisting).toHaveBeenCalled();
    expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Bulk indexing started' });
  });
});
