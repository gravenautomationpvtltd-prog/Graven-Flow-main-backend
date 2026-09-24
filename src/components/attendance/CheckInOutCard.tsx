import { useState } from 'react';
import { format, differenceInMinutes } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  LogIn, 
  Building2,
  AlertCircle,
  Loader2,
  CheckCircle2,
  MapPin,
  Coffee,
  Utensils,
  User,
  Pause,
  Play
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useGeolocation, isWithinGeofence } from '@/hooks/useGeolocation';
import { useTodayAttendance, useLocationCheckIn, useLocationCheckOut } from '@/hooks/useLocationAttendance';
import { useActiveBreak, useTodayBreaks, useStartBreak, useEndBreak, calculateTotalBreakTime, formatBreakTime, BreakType } from '@/hooks/useBreaks';
import { SelfieCapture } from './SelfieCapture';
import { LiveClock } from './LiveClock';
import { SlideToAction } from './SlideToAction';
import { ConfirmCheckoutDialog } from './ConfirmCheckoutDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Office {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  geofence_radius_meters: number | null;
  opening_time?: string | null;
  closing_time?: string | null;
}

interface CheckInOutCardProps {
  userOffice?: Office | null;
}

export function CheckInOutCard({ userOffice }: CheckInOutCardProps) {
  const { user, profile } = useAuth();
  const { getCurrentPosition, loading: geoLoading, error: geoError } = useGeolocation();
  const { data: todayRecord, isLoading: recordLoading } = useTodayAttendance(user?.id);
  const checkIn = useLocationCheckIn();
  const checkOut = useLocationCheckOut();
  
  const [showSelfieCapture, setShowSelfieCapture] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'checking' | 'in-office' | 'field' | null>(null);
  const [checkoutConfirmOpen, setCheckoutConfirmOpen] = useState(false);

  // Break hooks
  const { data: activeBreak, isLoading: activeBreakLoading } = useActiveBreak(user?.id);
  const { data: todayBreaks = [] } = useTodayBreaks(user?.id);
  const startBreak = useStartBreak();
  const endBreak = useEndBreak();

  const hasCheckedIn = !!todayRecord?.check_in_time;
  const hasCheckedOut = !!todayRecord?.check_out_time;
  const isOnBreak = !!activeBreak;
  const totalBreakMinutes = calculateTotalBreakTime(todayBreaks);

  // Calculate hours worked
  const getHoursWorked = () => {
    if (!todayRecord?.check_in_time) return 0;
    const checkInTime = new Date(todayRecord.check_in_time);
    const endTime = todayRecord.check_out_time ? new Date(todayRecord.check_out_time) : new Date();
    const totalMinutes = differenceInMinutes(endTime, checkInTime);
    // Subtract break time from total working time
    const workingMinutes = totalMinutes - totalBreakMinutes;
    return workingMinutes / 60;
  };

  const handleStartBreak = async (breakType: BreakType) => {
    if (!user || !todayRecord) return;
    
    await startBreak.mutateAsync({
      userId: user.id,
      attendanceId: todayRecord.id,
      breakType,
    });
  };

  const handleEndBreak = async () => {
    if (!user || !activeBreak) return;
    
    await endBreak.mutateAsync({
      breakId: activeBreak.id,
      userId: user.id,
    });
  };

  const handleCheckIn = async () => {
    if (!user || !profile) return;

    try {
      const position = await getCurrentPosition();
      
      if (userOffice?.latitude && userOffice?.longitude && userOffice?.geofence_radius_meters) {
        const withinOffice = isWithinGeofence(
          position.latitude,
          position.longitude,
          userOffice.latitude,
          userOffice.longitude,
          userOffice.geofence_radius_meters
        );

        if (withinOffice) {
          setLocationStatus('in-office');
          await checkIn.mutateAsync({
            userId: user.id,
            officeId: profile.office_id,
            latitude: position.latitude,
            longitude: position.longitude,
            attendanceType: 'office',
          });
          toast.success('Checked in from office!');
        } else {
          setLocationStatus('field');
          setPendingLocation({ lat: position.latitude, lng: position.longitude });
          setShowSelfieCapture(true);
        }
      } else {
        await checkIn.mutateAsync({
          userId: user.id,
          officeId: profile.office_id,
          latitude: position.latitude,
          longitude: position.longitude,
          attendanceType: 'office',
        });
        toast.success('Checked in!');
      }
    } catch (err) {
      console.error('Check-in error:', err);
      toast.error('Failed to check in. Please try again.');
    }
  };

  const handleSelfieCapture = async (blob: Blob) => {
    if (!user || !pendingLocation) return;

    try {
      setIsUploading(true);
      
      const fileName = `${user.id}/${format(new Date(), 'yyyy-MM-dd-HH-mm-ss')}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('attendance-selfies')
        .upload(fileName, blob, { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('attendance-selfies')
        .getPublicUrl(fileName);

      await checkIn.mutateAsync({
        userId: user.id,
        officeId: profile?.office_id || null,
        latitude: pendingLocation.lat,
        longitude: pendingLocation.lng,
        attendanceType: 'field',
        selfieUrl: urlData.publicUrl,
      });

      toast.success('Field attendance recorded!');
      setPendingLocation(null);
      setLocationStatus(null);
    } catch (err) {
      console.error('Selfie upload error:', err);
      toast.error('Failed to upload selfie. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!user || !profile) return;

    console.info('[attendance] checkout_start', {
      userId: user.id,
      attendanceId: todayRecord?.id,
      ts: new Date().toISOString(),
    });

    try {
      const position = await getCurrentPosition();

      await checkOut.mutateAsync({
        userId: user.id,
        officeId: profile.office_id,
        latitude: position.latitude,
        longitude: position.longitude,
      });

      console.info('[attendance] checkout_success', {
        userId: user.id,
        attendanceId: todayRecord?.id,
        ts: new Date().toISOString(),
      });

      toast.success('Checked out successfully!');
    } catch (err) {
      console.error('[attendance] checkout_error', err);
      toast.error('Failed to check out. Please try again.');
    }
  };

  const handleCheckoutSlideComplete = () => {
    console.info('[attendance] checkout_slide_complete', {
      userId: user?.id,
      attendanceId: todayRecord?.id,
      ts: new Date().toISOString(),
    });

    setCheckoutConfirmOpen(true);
  };

  const handleConfirmCheckout = async () => {
    console.info('[attendance] checkout_confirm_clicked', {
      userId: user?.id,
      attendanceId: todayRecord?.id,
      ts: new Date().toISOString(),
    });

    await handleCheckOut();
    setCheckoutConfirmOpen(false);
  };

  const isLoading = geoLoading || checkIn.isPending || checkOut.isPending || recordLoading || startBreak.isPending || endBreak.isPending;

  const getStatusInfo = () => {
    if (hasCheckedOut) {
      return { 
        label: 'Day Completed', 
        color: 'bg-muted text-muted-foreground',
        dot: 'bg-muted-foreground'
      };
    }
    if (isOnBreak) {
      const breakLabels: Record<BreakType, string> = {
        lunch: 'On Lunch Break',
        tea: 'On Tea Break',
        personal: 'On Personal Break',
        other: 'On Break',
      };
      return { 
        label: breakLabels[activeBreak.break_type as BreakType], 
        color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        dot: 'bg-amber-500 animate-pulse'
      };
    }
    if (hasCheckedIn) {
      return { 
        label: 'Working (Shift A)', 
        color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        dot: 'bg-green-500 animate-pulse'
      };
    }
    return { 
      label: 'Not Started', 
      color: 'bg-muted text-muted-foreground',
      dot: 'bg-muted-foreground'
    };
  };

  const status = getStatusInfo();

  // Get current break duration in minutes
  const getCurrentBreakDuration = () => {
    if (!activeBreak) return 0;
    return differenceInMinutes(new Date(), new Date(activeBreak.start_time));
  };

  return (
    <>
      <Card className="overflow-hidden">
        <CardContent className="p-6">
          {/* Status Badge */}
          <div className="flex justify-center mb-6">
            <Badge className={cn("px-4 py-1.5 text-sm font-medium", status.color)}>
              <span className={cn("w-2 h-2 rounded-full mr-2", status.dot)} />
              {status.label}
            </Badge>
          </div>

          {/* Live Clock */}
          <div className="text-center mb-2">
            <LiveClock className="text-5xl font-bold tracking-tight" />
          </div>

          {/* Date */}
          <p className="text-center text-muted-foreground mb-6">
            {format(new Date(), 'EEEE, MMM d')}
          </p>

          {/* Check In/Out Times when checked in */}
          {hasCheckedIn && (
            <div className="flex items-center justify-center gap-6 mb-6 text-sm">
              <div className="text-center">
                <span className="text-muted-foreground">In</span>
                <p className="font-semibold text-green-600 dark:text-green-400">
                  {format(new Date(todayRecord!.check_in_time!), 'hh:mm a')}
                </p>
              </div>
              {hasCheckedOut && (
                <div className="text-center">
                  <span className="text-muted-foreground">Out</span>
                  <p className="font-semibold text-red-600 dark:text-red-400">
                    {format(new Date(todayRecord!.check_out_time!), 'hh:mm a')}
                  </p>
                </div>
              )}
              {hasCheckedOut && todayRecord?.total_hours_worked && (
                <div className="text-center">
                  <span className="text-muted-foreground">Total</span>
                  <p className="font-semibold">
                    {todayRecord.total_hours_worked.toFixed(1)}h
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {geoError && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-destructive/10 text-destructive rounded-lg text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{geoError.message}</span>
            </div>
          )}

          {/* Break Status Display */}
          {isOnBreak && (
            <div className="mb-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Coffee className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <span className="font-medium text-amber-700 dark:text-amber-300">
                    {activeBreak.break_type === 'lunch' && 'Lunch Break'}
                    {activeBreak.break_type === 'tea' && 'Tea Break'}
                    {activeBreak.break_type === 'personal' && 'Personal Break'}
                    {activeBreak.break_type === 'other' && 'Break'}
                  </span>
                </div>
                <Badge variant="outline" className="text-amber-600 border-amber-300">
                  {formatBreakTime(getCurrentBreakDuration())}
                </Badge>
              </div>
              <Button 
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                onClick={handleEndBreak}
                disabled={isLoading}
              >
                {endBreak.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                End Break & Resume Work
              </Button>
            </div>
          )}

          {/* Total Break Time Display */}
          {hasCheckedIn && !hasCheckedOut && totalBreakMinutes > 0 && !isOnBreak && (
            <div className="flex items-center justify-center gap-2 mb-4 text-sm text-muted-foreground">
              <Pause className="h-4 w-4" />
              <span>Total break time today: {formatBreakTime(totalBreakMinutes)}</span>
            </div>
          )}

          {/* Action Button/Slider */}
          <div className="mb-4">
            {!hasCheckedIn ? (
              <Button 
                className="w-full h-14 text-base font-semibold rounded-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700" 
                onClick={handleCheckIn}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <LogIn className="mr-2 h-5 w-5" />
                )}
                Check In
              </Button>
            ) : !hasCheckedOut && !isOnBreak ? (
              <div className="space-y-3">
                <SlideToAction 
                  onComplete={handleCheckoutSlideComplete}
                  disabled={isLoading}
                  label="Slide to Check Out"
                  variant="checkout"
                />
                
                {/* Take Break Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-full h-12"
                      disabled={isLoading}
                    >
                      <Coffee className="mr-2 h-4 w-4" />
                      Take a Break
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="center">
                    <DropdownMenuItem onClick={() => handleStartBreak('lunch')}>
                      <Utensils className="mr-2 h-4 w-4" />
                      <span>Lunch Break</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStartBreak('tea')}>
                      <Coffee className="mr-2 h-4 w-4" />
                      <span>Tea Break</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStartBreak('personal')}>
                      <User className="mr-2 h-4 w-4" />
                      <span>Personal Break</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : hasCheckedOut ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded-xl border border-amber-100 dark:border-amber-900/50">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium text-sm">
                    Day ended early • {todayRecord!.total_hours_worked?.toFixed(1)}h worked
                  </span>
                </div>
                <Button 
                  className="w-full h-14 text-base font-semibold rounded-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700" 
                  onClick={handleCheckIn}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <LogIn className="mr-2 h-5 w-5" />
                  )}
                  Resume Work
                </Button>
              </div>
            ) : null}
          </div>

          {/* Office Location */}
          {userOffice && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{userOffice.name}</span>
              {userOffice.geofence_radius_meters && (
                <span className="text-xs">
                  ({userOffice.geofence_radius_meters}m radius)
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmCheckoutDialog
        open={checkoutConfirmOpen}
        onOpenChange={setCheckoutConfirmOpen}
        hoursWorked={getHoursWorked()}
        onConfirm={handleConfirmCheckout}
        isLoading={isLoading}
      />

      <SelfieCapture
        open={showSelfieCapture}
        onOpenChange={(open) => {
          setShowSelfieCapture(open);
          if (!open) {
            setPendingLocation(null);
            setLocationStatus(null);
          }
        }}
        onCapture={handleSelfieCapture}
        isUploading={isUploading}
      />
    </>
  );
}
