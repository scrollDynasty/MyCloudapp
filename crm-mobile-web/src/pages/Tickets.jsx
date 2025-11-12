import {
    CheckCircle as CheckCircleIcon,
    Delete as DeleteIcon,
    Refresh as RefreshIcon,
    Visibility as VisibilityIcon
} from '@mui/icons-material';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    Grid,
    IconButton,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Typography
} from '@mui/material';
import React, { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://apibilling.mycloud.uz';

export default function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadTickets();
  }, [statusFilter, sortOrder]);

  const loadTickets = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('crm_token');
      const params = new URLSearchParams();
      
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      params.append('sort', sortOrder);

      const response = await fetch(`${API_URL}/tickets?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        setTickets(data.data);
      } else {
        setError(data.message || 'Не удалось загрузить тикеты');
      }
    } catch (err) {
      console.error('Error loading tickets:', err);
      setError('Ошибка при загрузке тикетов');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (ticketId, newStatus) => {
    setUpdating(true);

    try {
      const token = localStorage.getItem('crm_token');
      const response = await fetch(`${API_URL}/tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await response.json();

      if (data.success) {
        // Обновляем локальный список
        setTickets(tickets.map(ticket =>
          ticket.id === ticketId
            ? { ...ticket, status: newStatus, answered_at: newStatus === 'answered' ? new Date() : ticket.answered_at }
            : ticket
        ));

        // Если открыто окно деталей, обновляем и его
        if (selectedTicket && selectedTicket.id === ticketId) {
          setSelectedTicket({
            ...selectedTicket,
            status: newStatus,
            answered_at: newStatus === 'answered' ? new Date() : selectedTicket.answered_at
          });
        }
      } else {
        alert(data.message || 'Не удалось обновить статус');
      }
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Ошибка при обновлении статуса');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (ticketId) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот тикет?')) {
      return;
    }

    try {
      const token = localStorage.getItem('crm_token');
      const response = await fetch(`${API_URL}/tickets/${ticketId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        setTickets(tickets.filter(ticket => ticket.id !== ticketId));
        if (selectedTicket && selectedTicket.id === ticketId) {
          setDetailsOpen(false);
          setSelectedTicket(null);
        }
      } else {
        alert(data.message || 'Не удалось удалить тикет');
      }
    } catch (err) {
      console.error('Error deleting ticket:', err);
      alert('Ошибка при удалении тикета');
    }
  };

  const openDetails = (ticket) => {
    setSelectedTicket(ticket);
    setDetailsOpen(true);
  };

  const closeDetails = () => {
    setDetailsOpen(false);
    setSelectedTicket(null);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open':
        return 'warning';
      case 'answered':
        return 'success';
      case 'closed':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'open':
        return 'Открыт';
      case 'answered':
        return 'Отвечен';
      case 'closed':
        return 'Закрыт';
      default:
        return status;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          Тикеты поддержки
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadTickets}
          disabled={loading}
        >
          Обновить
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Статус</InputLabel>
                <Select
                  value={statusFilter}
                  label="Статус"
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="all">Все тикеты</MenuItem>
                  <MenuItem value="open">Открытые</MenuItem>
                  <MenuItem value="answered">Отвеченные</MenuItem>
                  <MenuItem value="closed">Закрытые</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Сортировка</InputLabel>
                <Select
                  value={sortOrder}
                  label="Сортировка"
                  onChange={(e) => setSortOrder(e.target.value)}
                >
                  <MenuItem value="desc">Сначала новые</MenuItem>
                  <MenuItem value="asc">Сначала старые</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="body2" color="text.secondary">
                Всего тикетов: {tickets.length}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Loading */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        /* Table */
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Клиент</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Телефон</TableCell>
                <TableCell>Тема</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell>Создан</TableCell>
                <TableCell>Отвечен</TableCell>
                <TableCell align="center">Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                      Тикеты не найдены
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                tickets.map((ticket) => (
                  <TableRow key={ticket.id} hover>
                    <TableCell>{ticket.id}</TableCell>
                    <TableCell>{ticket.full_name || '—'}</TableCell>
                    <TableCell>{ticket.email || '—'}</TableCell>
                    <TableCell>{ticket.phone}</TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                        {ticket.subject}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusLabel(ticket.status)}
                        color={getStatusColor(ticket.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{formatDate(ticket.created_at)}</TableCell>
                    <TableCell>{formatDate(ticket.answered_at)}</TableCell>
                    <TableCell align="center">
                      <Tooltip title="Просмотр">
                        <IconButton
                          size="small"
                          onClick={() => openDetails(ticket)}
                          color="primary"
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {ticket.status === 'open' && (
                        <Tooltip title="Отметить как отвеченный">
                          <IconButton
                            size="small"
                            onClick={() => handleStatusChange(ticket.id, 'answered')}
                            color="success"
                            disabled={updating}
                          >
                            <CheckCircleIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Удалить">
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(ticket.id)}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onClose={closeDetails} maxWidth="md" fullWidth>
        {selectedTicket && (
          <>
            <DialogTitle>
              Тикет #{selectedTicket.id} — {selectedTicket.subject}
            </DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Клиент
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {selectedTicket.full_name || '—'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Email
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {selectedTicket.email || '—'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Телефон
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {selectedTicket.phone}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Статус
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Chip
                      label={getStatusLabel(selectedTicket.status)}
                      color={getStatusColor(selectedTicket.status)}
                      size="small"
                    />
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Создан
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {formatDate(selectedTicket.created_at)}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Отвечен
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {formatDate(selectedTicket.answered_at)}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Сообщение
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                      {selectedTicket.message}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* Status Change */}
              {selectedTicket.status !== 'closed' && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Изменить статус
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {selectedTicket.status === 'open' && (
                      <Button
                        variant="contained"
                        color="success"
                        size="small"
                        onClick={() => handleStatusChange(selectedTicket.id, 'answered')}
                        disabled={updating}
                      >
                        Отметить как отвеченный
                      </Button>
                    )}
                    <Button
                      variant="outlined"
                      color="inherit"
                      size="small"
                      onClick={() => handleStatusChange(selectedTicket.id, 'closed')}
                      disabled={updating}
                    >
                      Закрыть тикет
                    </Button>
                  </Box>
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={closeDetails}>Закрыть</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
}

